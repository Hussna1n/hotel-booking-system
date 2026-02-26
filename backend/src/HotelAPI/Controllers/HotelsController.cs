using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using HotelAPI.Data;
using HotelAPI.Models;

namespace HotelAPI.Controllers;

[ApiController]
[Route("api/hotels")]
public class HotelsController : ControllerBase
{
    private readonly AppDbContext _db;

    public HotelsController(AppDbContext db) => _db = db;

    public record SearchDto(string? City, DateTime CheckIn, DateTime CheckOut, int Adults, int Children, RoomType? RoomType, decimal? MaxPrice, int Page = 1, int Limit = 20);
    public record CreateBookingDto(int RoomId, DateTime CheckIn, DateTime CheckOut, int Adults, int Children, string? SpecialRequests);

    [HttpGet]
    public async Task<IActionResult> SearchHotels([FromQuery] SearchDto dto)
    {
        var q = _db.Hotels.Include(h => h.Rooms).Where(h => h.IsActive);
        if (!string.IsNullOrEmpty(dto.City)) q = q.Where(h => h.City.ToLower().Contains(dto.City.ToLower()));

        // Filter hotels that have at least one available room in date range
        var nights = (dto.CheckOut - dto.CheckIn).Days;
        if (nights <= 0) return BadRequest(new { message = "Check-out must be after check-in" });

        var hotels = await q.OrderByDescending(h => h.StarRating)
            .Skip((dto.Page - 1) * dto.Limit).Take(dto.Limit)
            .Select(h => new
            {
                h.Id, h.Name, h.City, h.Country, h.StarRating, h.Images, h.Amenities,
                AvailableRooms = h.Rooms.Where(r => r.IsAvailable &&
                    (!dto.RoomType.HasValue || r.Type == dto.RoomType) &&
                    r.MaxOccupancy >= dto.Adults + dto.Children &&
                    (!dto.MaxPrice.HasValue || r.PricePerNight <= dto.MaxPrice) &&
                    !r.Bookings.Any(b =>
                        b.Status != BookingStatus.Cancelled &&
                        b.Status != BookingStatus.NoShow &&
                        b.CheckIn < dto.CheckOut && b.CheckOut > dto.CheckIn)
                ).Count(),
                MinPrice = h.Rooms.Any() ? h.Rooms.Min(r => r.PricePerNight) : 0
            })
            .ToListAsync();

        return Ok(hotels.Where(h => h.AvailableRooms > 0));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetHotel(int id)
    {
        var hotel = await _db.Hotels
            .Include(h => h.Rooms)
            .Include(h => h.Reviews)
            .FirstOrDefaultAsync(h => h.Id == id);
        if (hotel == null) return NotFound();

        var avgRating = hotel.Reviews.Any() ? hotel.Reviews.Average(r => r.Rating) : 0;
        return Ok(new { hotel, avgRating, reviewCount = hotel.Reviews.Count });
    }

    [HttpGet("{hotelId}/rooms/availability")]
    public async Task<IActionResult> GetAvailableRooms(int hotelId, [FromQuery] DateTime checkIn, [FromQuery] DateTime checkOut, [FromQuery] int guests = 1)
    {
        if (checkOut <= checkIn) return BadRequest(new { message = "Invalid dates" });

        var rooms = await _db.Rooms
            .Include(r => r.Bookings)
            .Where(r => r.HotelId == hotelId && r.IsAvailable && r.MaxOccupancy >= guests)
            .ToListAsync();

        var available = rooms.Where(r => !r.Bookings.Any(b =>
            b.Status != BookingStatus.Cancelled &&
            b.Status != BookingStatus.NoShow &&
            b.CheckIn < checkOut && b.CheckOut > checkIn
        )).Select(r => new
        {
            r.Id, r.RoomNumber, r.Type, r.PricePerNight, r.MaxOccupancy,
            r.Description, r.Amenities, r.Images, r.FloorNumber,
            TotalPrice = r.PricePerNight * (decimal)(checkOut - checkIn).Days
        }).ToList();

        return Ok(available);
    }

    [HttpGet("{hotelId}/slots")]
    public async Task<IActionResult> GetAvailabilitySlots(int hotelId, [FromQuery] int year, [FromQuery] int month)
    {
        var start = new DateTime(year, month, 1);
        var end = start.AddMonths(1);

        var bookings = await _db.Bookings
            .Where(b => b.Room.HotelId == hotelId &&
                b.Status != BookingStatus.Cancelled &&
                b.CheckIn < end && b.CheckOut > start)
            .Select(b => new { b.CheckIn, b.CheckOut, b.RoomId })
            .ToListAsync();

        var totalRooms = await _db.Rooms.CountAsync(r => r.HotelId == hotelId && r.IsAvailable);

        var slots = Enumerable.Range(0, (end - start).Days).Select(d =>
        {
            var day = start.AddDays(d);
            var occupied = bookings.Count(b => b.CheckIn <= day && b.CheckOut > day);
            return new { date = day.ToString("yyyy-MM-dd"), totalRooms, occupied, available = totalRooms - occupied };
        });

        return Ok(slots);
    }

    [HttpPost("bookings")]
    [Authorize]
    public async Task<IActionResult> CreateBooking([FromBody] CreateBookingDto dto)
    {
        var guestId = int.Parse(User.FindFirst("sub")!.Value);
        var nights = (dto.CheckOut - dto.CheckIn).Days;
        if (nights <= 0) return BadRequest(new { message = "Invalid date range" });

        var room = await _db.Rooms.Include(r => r.Bookings).FirstOrDefaultAsync(r => r.Id == dto.RoomId);
        if (room == null || !room.IsAvailable) return NotFound();

        var conflict = room.Bookings.Any(b =>
            b.Status != BookingStatus.Cancelled &&
            b.Status != BookingStatus.NoShow &&
            b.CheckIn < dto.CheckOut && b.CheckOut > dto.CheckIn);
        if (conflict) return BadRequest(new { message = "Room not available for selected dates" });

        var booking = new Booking
        {
            RoomId = dto.RoomId,
            GuestId = guestId,
            CheckIn = dto.CheckIn,
            CheckOut = dto.CheckOut,
            Adults = dto.Adults,
            Children = dto.Children,
            TotalPrice = room.PricePerNight * nights,
            SpecialRequests = dto.SpecialRequests,
            Status = BookingStatus.Confirmed
        };
        _db.Bookings.Add(booking);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetBooking), new { id = booking.Id }, booking);
    }

    [HttpGet("bookings/{id}")]
    [Authorize]
    public async Task<IActionResult> GetBooking(int id)
    {
        var guestId = int.Parse(User.FindFirst("sub")!.Value);
        var booking = await _db.Bookings.Include(b => b.Room).ThenInclude(r => r.Hotel)
            .FirstOrDefaultAsync(b => b.Id == id && b.GuestId == guestId);
        return booking == null ? NotFound() : Ok(booking);
    }

    [HttpPost("bookings/{id}/cancel")]
    [Authorize]
    public async Task<IActionResult> CancelBooking(int id)
    {
        var guestId = int.Parse(User.FindFirst("sub")!.Value);
        var booking = await _db.Bookings.FirstOrDefaultAsync(b => b.Id == id && b.GuestId == guestId);
        if (booking == null) return NotFound();
        if (booking.Status == BookingStatus.CheckedIn) return BadRequest(new { message = "Cannot cancel while checked in" });

        booking.Status = BookingStatus.Cancelled;
        await _db.SaveChangesAsync();
        return Ok(new { booking.Id, booking.ConfirmationCode, booking.Status });
    }
}

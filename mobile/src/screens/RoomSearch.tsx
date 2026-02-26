import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

interface SearchParams {
  city: string;
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
}

interface Props {
  onSearch: (params: SearchParams) => void;
}

function GuestCounter({ label, sublabel, value, onChange, min = 0, max = 8 }: {
  label: string; sublabel: string; value: number;
  onChange: (v: number) => void; min?: number; max?: number;
}) {
  return (
    <View style={styles.counterRow}>
      <View style={styles.counterLabel}>
        <Text style={styles.counterTitle}>{label}</Text>
        <Text style={styles.counterSub}>{sublabel}</Text>
      </View>
      <View style={styles.counterControls}>
        <Pressable
          onPress={() => onChange(Math.max(min, value - 1))}
          style={[styles.counterBtn, value <= min && styles.counterBtnDisabled]}
          disabled={value <= min}
        >
          <Ionicons name="remove" size={18} color={value <= min ? '#d1d5db' : '#6366f1'} />
        </Pressable>
        <Text style={styles.counterValue}>{value}</Text>
        <Pressable
          onPress={() => onChange(Math.min(max, value + 1))}
          style={[styles.counterBtn, value >= max && styles.counterBtnDisabled]}
          disabled={value >= max}
        >
          <Ionicons name="add" size={18} color={value >= max ? '#d1d5db' : '#6366f1'} />
        </Pressable>
      </View>
    </View>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function RoomSearch({ onSearch }: Props) {
  const tomorrow = new Date(Date.now() + 86400000);
  const dayAfter = new Date(Date.now() + 2 * 86400000);

  const [checkIn, setCheckIn] = useState(tomorrow);
  const [checkOut, setCheckOut] = useState(dayAfter);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showCheckOut, setShowCheckOut] = useState(false);

  const nights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000));

  const onChangeCheckIn = (_: DateTimePickerEvent, d?: Date) => {
    setShowCheckIn(false);
    if (d) {
      setCheckIn(d);
      if (d >= checkOut) setCheckOut(new Date(d.getTime() + 86400000));
    }
  };

  const onChangeCheckOut = (_: DateTimePickerEvent, d?: Date) => {
    setShowCheckOut(false);
    if (d && d > checkIn) setCheckOut(d);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.heading}>Find your perfect room</Text>

      {/* Date Pickers */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Dates</Text>
        <View style={styles.dateRow}>
          <Pressable onPress={() => setShowCheckIn(true)} style={styles.datePicker}>
            <Ionicons name="calendar-outline" size={20} color="#6366f1" />
            <View style={styles.dateInfo}>
              <Text style={styles.dateLabel}>Check-in</Text>
              <Text style={styles.dateValue}>{formatDate(checkIn)}</Text>
            </View>
          </Pressable>
          <View style={styles.nightsBadge}>
            <Text style={styles.nightsText}>{nights}n</Text>
          </View>
          <Pressable onPress={() => setShowCheckOut(true)} style={styles.datePicker}>
            <Ionicons name="calendar-outline" size={20} color="#6366f1" />
            <View style={styles.dateInfo}>
              <Text style={styles.dateLabel}>Check-out</Text>
              <Text style={styles.dateValue}>{formatDate(checkOut)}</Text>
            </View>
          </Pressable>
        </View>
      </View>

      {showCheckIn && (
        <DateTimePicker value={checkIn} mode="date" minimumDate={new Date()} onChange={onChangeCheckIn} />
      )}
      {showCheckOut && (
        <DateTimePicker value={checkOut} mode="date" minimumDate={new Date(checkIn.getTime() + 86400000)} onChange={onChangeCheckOut} />
      )}

      {/* Guests */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Guests</Text>
        <GuestCounter label="Adults" sublabel="Age 18+" value={adults} onChange={setAdults} min={1} />
        <View style={styles.divider} />
        <GuestCounter label="Children" sublabel="Ages 0–17" value={children} onChange={setChildren} />
      </View>

      {/* Summary */}
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {adults + children} guest{adults + children !== 1 ? 's' : ''} · {nights} night{nights !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Search Button */}
      <Pressable
        onPress={() => onSearch({ city: '', checkIn, checkOut, adults, children })}
        style={({ pressed }) => [styles.searchBtn, pressed && styles.searchBtnPressed]}
      >
        <Ionicons name="search" size={20} color="#fff" />
        <Text style={styles.searchBtnText}>Search Available Rooms</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 20 },
  heading: { fontSize: 26, fontWeight: '800', color: '#111827', marginBottom: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#9ca3af', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  datePicker: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f8fafc', borderRadius: 12, padding: 12 },
  dateInfo: { flex: 1 },
  dateLabel: { fontSize: 11, color: '#9ca3af', marginBottom: 2 },
  dateValue: { fontSize: 14, fontWeight: '600', color: '#111827' },
  nightsBadge: { backgroundColor: '#ede9fe', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  nightsText: { fontSize: 12, fontWeight: '700', color: '#6366f1' },
  counterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  counterLabel: {},
  counterTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  counterSub: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  counterControls: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  counterBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#ede9fe', justifyContent: 'center', alignItems: 'center' },
  counterBtnDisabled: { backgroundColor: '#f3f4f6' },
  counterValue: { fontSize: 18, fontWeight: '700', color: '#111827', minWidth: 24, textAlign: 'center' },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 12 },
  summary: { backgroundColor: '#ede9fe', borderRadius: 12, padding: 12, marginBottom: 20, alignItems: 'center' },
  summaryText: { fontSize: 14, fontWeight: '600', color: '#6366f1' },
  searchBtn: { backgroundColor: '#6366f1', borderRadius: 16, padding: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, elevation: 4, shadowColor: '#6366f1', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  searchBtnPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  searchBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

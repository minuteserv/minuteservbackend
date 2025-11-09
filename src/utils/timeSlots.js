/**
 * Generate time slots for booking
 */
function generateTimeSlots() {
  const slots = [];
  const startHour = 8;
  const endHour = 19;
  const intervalMinutes = 30;

  for (let hour = startHour; hour <= endHour; hour++) {
    for (let minute = 0; minute < 60; minute += intervalMinutes) {
      if (hour === endHour && minute > 0) break; // Stop at 7:00 PM

      const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const minuteStr = minute.toString().padStart(2, '0');

      slots.push(`${hour12}:${minuteStr} ${ampm}`);
    }
  }

  return slots;
}

module.exports = {
  generateTimeSlots
};


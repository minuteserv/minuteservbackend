function generateBookingNumber() {
  const timestampSegment = Date.now().toString(36).toUpperCase();
  const randomSegment = Math.random().toString(36).substring(2, 8).toUpperCase();
  const uniqueSuffix = `${timestampSegment}${randomSegment}`.slice(-6);

  return `MS-${uniqueSuffix}`;
}

module.exports = {
  generateBookingNumber
};


export function getMonthRanges(baseDate = new Date()) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth(); // 0-based

  const startOfCurrentMonth = new Date(year, month, 1);
  const startOfNextMonth = new Date(year, month + 1, 1);
  const startOfLastMonth = new Date(year, month - 1, 1);

  return {
    lastMonth: {
      from: startOfLastMonth,
      to: startOfCurrentMonth,
    },
    currentMonth: {
      from: startOfCurrentMonth,
      to: startOfNextMonth,
    },
    nextMonth: {
      from: startOfNextMonth,
      to: new Date(year, month + 2, 1),
    },
  };
}

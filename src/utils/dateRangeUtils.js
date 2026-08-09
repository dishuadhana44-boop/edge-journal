import {
    startOfMonth,
    endOfMonth,
    startOfDay,
    endOfDay,
    subDays,
    subMonths,
    subYears,
  } from "date-fns";
  
  export const DATE_FILTERS = {
    TODAY: "Today",
    ONE_WEEK: "1W",
    TWO_WEEKS: "2W",
    ONE_MONTH: "1M",
    THREE_MONTHS: "3M",
    SIX_MONTHS: "6M",
    ONE_YEAR: "1Y",
    ALL: "ALL",
    CUSTOM: "Custom",
  };
  
  export function getDateRange(filter) {
    const now = new Date();
  
    switch (filter) {
      case DATE_FILTERS.TODAY:
        return {
          startDate: startOfDay(now),
          endDate: endOfDay(now),
        };
  
      case DATE_FILTERS.ONE_WEEK:
        return {
          startDate: startOfDay(subDays(now, 6)),
          endDate: endOfDay(now),
        };
  
      case DATE_FILTERS.TWO_WEEKS:
        return {
          startDate: startOfDay(subDays(now, 13)),
          endDate: endOfDay(now),
        };
  
      case DATE_FILTERS.ONE_MONTH:
        return {
          startDate: startOfMonth(now),
          endDate: endOfMonth(now),
        };
  
      case DATE_FILTERS.THREE_MONTHS:
        return {
          startDate: startOfMonth(subMonths(now, 2)),
          endDate: endOfDay(now),
        };
  
      case DATE_FILTERS.SIX_MONTHS:
        return {
          startDate: startOfMonth(subMonths(now, 5)),
          endDate: endOfDay(now),
        };
  
      case DATE_FILTERS.ONE_YEAR:
        return {
          startDate: startOfDay(subYears(now, 1)),
          endDate: endOfDay(now),
        };
  
      case DATE_FILTERS.ALL:
        return {
          startDate: new Date(2000, 0, 1),
          endDate: endOfDay(now),
        };
  
      default:
        return {
          startDate: startOfMonth(now),
          endDate: endOfMonth(now),
        };
    }
  }

  export function formatDateRange(startDate, endDate) {
    return {
      startDate,
      endDate,
    };
  }


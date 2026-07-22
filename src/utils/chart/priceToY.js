export function priceToY(

    price,
    high,
    low,
    chartHeight
  
  ) {
  
    const percentage =
      (high - price) /
      (high - low);
  
    return percentage * chartHeight;
  
  }
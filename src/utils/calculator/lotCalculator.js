export function calculateLotSize(
    riskAmount,
    pipDistance
  ) {
  
    const pipValue = 10;
  
    if (pipDistance <= 0) return 0;
  
    return (
      riskAmount /
      (pipDistance * pipValue)
    );
  
  }
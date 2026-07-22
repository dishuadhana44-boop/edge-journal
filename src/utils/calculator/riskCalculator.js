export function calculateRiskAmount(balance, riskPercent) {

    return (
      Number(balance) *
      Number(riskPercent) /
      100
    );
  
  }
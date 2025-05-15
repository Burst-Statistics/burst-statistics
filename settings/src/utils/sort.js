export const percentageSort = ( rowA, rowB, field ) => {
  const numA = parseFloat( rowA[field]);
  const numB = parseFloat( rowB[field]);
  return numA - numB;
};

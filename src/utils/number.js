export function trimNumber(number) {
  return Number(number.toFixed(1)).toString()
}

export function formatCompactCount(value = 0) {
  const count = Number(value) || 0

  if (count >= 100000000) {
    return `${trimNumber(count / 100000000)}亿`
  }

  if (count >= 10000) {
    return `${trimNumber(count / 10000)}万`
  }

  return String(count)
}


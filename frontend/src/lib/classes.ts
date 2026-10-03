// Splits the districts into at most five classes for the map. Class 1 holds the lowest values and class 5 the highest.
// The classes have equal counts (quantiles), so the map shows the order of the districts; the exact values are in the table.

export const CLASS_COUNT = 5

export type ClassInfo = {
  /** 1 to CLASS_COUNT. */
  number: number
  /** The API's display strings of the lowest and highest value in the class. No number is formatted here. */
  minDisplay: string
  maxDisplay: string
}

type Value = { district: string; value: number; display: string }

export function classify(values: Value[]): { classOf: Map<string, number>; classes: ClassInfo[] } {
  const sorted = [...values].sort((a, b) => a.value - b.value)
  const classOf = new Map<string, number>()
  const members = new Map<number, Value[]>()
  const numberOfValue = new Map<number, number>()

  sorted.forEach((item, index) => {
    // Equal values share a class: the class of the first of them.
    const number = numberOfValue.get(item.value) ?? Math.min(CLASS_COUNT, Math.floor((index * CLASS_COUNT) / sorted.length) + 1)
    numberOfValue.set(item.value, number)
    classOf.set(item.district, number)
    members.set(number, [...(members.get(number) ?? []), item])
  })

  const classes = [...members.entries()]
    .sort(([a], [b]) => a - b)
    .map(([number, items]) => ({
      number,
      minDisplay: items[0]?.display ?? '',
      maxDisplay: items[items.length - 1]?.display ?? '',
    }))

  return { classOf, classes }
}

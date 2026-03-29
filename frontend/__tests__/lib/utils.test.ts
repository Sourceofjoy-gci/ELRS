import { cn, formatDate, formatTime, truncate, formatCitation, debounce } from '@/lib/utils'

describe('cn utility', () => {
  it('merges class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    const isActive = true
    expect(cn('base', isActive && 'active')).toBe('base active')
    expect(cn('base', !isActive && 'hidden')).toBe('base')
  })

  it('handles undefined and null', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar')
  })
})

describe('formatDate', () => {
  it('formats a date string', () => {
    const result = formatDate('2024-03-15')
    expect(result).toContain('2024')
    expect(result).toContain('March')
    expect(result).toContain('15')
  })

  it('formats a Date object', () => {
    const result = formatDate(new Date('2024-03-15'))
    expect(result).toContain('2024')
  })
})

describe('formatTime', () => {
  it('formats milliseconds', () => {
    expect(formatTime(500)).toBe('500ms')
  })

  it('formats seconds', () => {
    expect(formatTime(2500)).toBe('2.5s')
  })
})

describe('truncate', () => {
  it('truncates long strings', () => {
    const long = 'This is a very long string that should be truncated'
    expect(truncate(long, 20)).toBe('This is a very long...')
  })

  it('returns original string if shorter than limit', () => {
    expect(truncate('short', 20)).toBe('short')
  })
})

describe('formatCitation', () => {
  it('formats a basic citation', () => {
    expect(formatCitation('Employment Act', 1980, '35')).toBe(
      'Employment Act, 1980, s 35'
    )
  })

  it('formats citation with subsection', () => {
    expect(formatCitation('Employment Act', 1980, '35', '1')).toBe(
      'Employment Act, 1980, s 35(1)'
    )
  })

  it('handles null year', () => {
    expect(formatCitation('Constitution', null, '21')).toBe(
      'Constitution, s 21'
    )
  })
})

describe('debounce', () => {
  jest.useFakeTimers()

  it('debounces function calls', () => {
    const fn = jest.fn()
    const debounced = debounce(fn, 100)

    debounced()
    debounced()
    debounced()

    expect(fn).not.toHaveBeenCalled()

    jest.advanceTimersByTime(100)

    expect(fn).toHaveBeenCalledTimes(1)
  })
})

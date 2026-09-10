import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { formatDueLabel } from './dateUtils'

function toDatetimeLocalValue(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

describe('App', () => {
  it('adds a todo and toggles it done', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Nouvelle tâche'), 'Acheter du lait')
    await user.click(screen.getByRole('button', { name: 'Ajouter' }))

    expect(screen.getByText('Acheter du lait')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox'))
    expect(screen.getByText('Acheter du lait').closest('li')).toHaveClass('done')
  })

  it('deletes a todo', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Nouvelle tâche'), 'Acheter du lait')
    await user.click(screen.getByRole('button', { name: 'Ajouter' }))
    await user.click(screen.getByRole('button', { name: 'Supprimer Acheter du lait' }))

    expect(screen.queryByText('Acheter du lait')).not.toBeInTheDocument()
  })

  it('adding a task with a due date and difficulty shows it on the row', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Nouvelle tâche'), 'Finir le rapport')
    await user.click(screen.getByRole('button', { name: 'Ajouter des détails' }))
    await user.click(screen.getByRole('radio', { name: 'Difficile' }))

    const dueAtMs = Date.now() + 2 * 24 * 60 * 60 * 1000
    fireEvent.change(screen.getByLabelText('Échéance'), {
      target: { value: toDatetimeLocalValue(dueAtMs) },
    })

    await user.click(screen.getByRole('button', { name: 'Ajouter' }))

    expect(screen.getByLabelText('Difficulté : difficile')).toBeInTheDocument()
    expect(screen.getByText(formatDueLabel(dueAtMs))).toBeInTheDocument()
  })

  it('completing a task grants XP and starts a streak; uncompleting reverts them', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Nouvelle tâche'), 'Acheter du lait')
    await user.click(screen.getByRole('button', { name: 'Ajouter' }))

    expect(screen.getByText('0/100 XP')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox'))
    expect(screen.getByText('20/100 XP')).toBeInTheDocument()
    expect(screen.getByText(/1 jour/)).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox'))
    expect(screen.getByText('0/100 XP')).toBeInTheDocument()
    expect(screen.queryByText(/1 jour/)).not.toBeInTheDocument()
  })

  it('persists todos across a remount', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)

    await user.type(screen.getByLabelText('Nouvelle tâche'), 'Acheter du lait')
    await user.click(screen.getByRole('button', { name: 'Ajouter' }))
    unmount()

    render(<App />)
    expect(screen.getByText('Acheter du lait')).toBeInTheDocument()
  })
})

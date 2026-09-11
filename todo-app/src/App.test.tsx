import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { formatDueLabel } from './dateUtils'

type User = ReturnType<typeof userEvent.setup>

function toDatetimeLocalValue(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Picks a zone from the entry menu (its button also shows the pending-task count). */
async function openZone(user: User, name: string) {
  await user.click(screen.getByRole('button', { name: new RegExp(`^${name}`) }))
}

async function addTask(user: User, text: string) {
  await user.type(screen.getByLabelText('Nouvelle tâche'), text)
  await user.click(screen.getByRole('button', { name: 'Ajouter' }))
}

describe('App', () => {
  it('adds a todo and toggles it done', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openZone(user, 'Hector')

    await addTask(user, 'Acheter du lait')

    expect(screen.getByText('Acheter du lait')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox'))
    expect(screen.getByText('Acheter du lait').closest('li')).toHaveClass('done')
  })

  it('deletes a todo', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openZone(user, 'Hector')

    await addTask(user, 'Acheter du lait')
    await user.click(screen.getByRole('button', { name: 'Supprimer Acheter du lait' }))

    expect(screen.queryByText('Acheter du lait')).not.toBeInTheDocument()
  })

  it('adding a task with a due date and difficulty shows it on the row', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openZone(user, 'Hector')

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
    await openZone(user, 'Hector')

    await addTask(user, 'Acheter du lait')

    expect(screen.getByText('0/100 XP')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox'))
    expect(screen.getByText('20/100 XP')).toBeInTheDocument()
    expect(screen.getByText(/1 jour/)).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox'))
    expect(screen.getByText('0/100 XP')).toBeInTheDocument()
    expect(screen.queryByText(/1 jour/)).not.toBeInTheDocument()
  })

  it('edits a task and updates its text, difficulty, and due date', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openZone(user, 'Hector')

    await addTask(user, 'Acheter du lait')

    await user.click(screen.getByRole('button', { name: 'Modifier Acheter du lait' }))
    const editInput = screen.getByLabelText('Modifier le texte de la tâche')
    await user.clear(editInput)
    await user.type(editInput, 'Acheter du pain')
    await user.click(screen.getByRole('radio', { name: 'Difficile' }))
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(screen.getByText('Acheter du pain')).toBeInTheDocument()
    expect(screen.queryByText('Acheter du lait')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Difficulté : difficile')).toBeInTheDocument()
  })

  it('cancelling an edit leaves the task unchanged', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openZone(user, 'Hector')

    await addTask(user, 'Acheter du lait')

    await user.click(screen.getByRole('button', { name: 'Modifier Acheter du lait' }))
    await user.clear(screen.getByLabelText('Modifier le texte de la tâche'))
    await user.type(screen.getByLabelText('Modifier le texte de la tâche'), 'Autre chose')
    await user.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(screen.getByText('Acheter du lait')).toBeInTheDocument()
    expect(screen.queryByText('Autre chose')).not.toBeInTheDocument()
  })

  it('opens the stats page and back to the task list', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openZone(user, 'Hector')

    await addTask(user, 'Acheter du lait')
    await user.click(screen.getByRole('checkbox'))

    await user.click(screen.getByRole('button', { name: 'Voir la progression' }))

    expect(screen.getByRole('heading', { name: 'Progression' })).toBeInTheDocument()
    expect(screen.getByText('XP total')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nouvelle tâche')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '← Hector' }))

    expect(screen.getByLabelText('Nouvelle tâche')).toBeInTheDocument()
  })

  it('persists todos across a remount', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    await openZone(user, 'Hector')

    await addTask(user, 'Acheter du lait')
    unmount()

    render(<App />)
    await openZone(user, 'Hector')
    expect(screen.getByText('Acheter du lait')).toBeInTheDocument()
  })
})

describe('App zones', () => {
  it('starts on the zone menu and shows the chosen zone name at the top of its list', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('button', { name: /^Hector/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Nina/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Commun/ })).toBeInTheDocument()
    expect(screen.queryByLabelText('Nouvelle tâche')).not.toBeInTheDocument()

    await openZone(user, 'Nina')

    expect(screen.getByRole('heading', { name: 'Nina' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nouvelle tâche')).toBeInTheDocument()
  })

  it('clicking the zone name returns to the zone menu', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openZone(user, 'Commun')

    await user.click(screen.getByRole('button', { name: 'Commun' }))

    expect(screen.queryByLabelText('Nouvelle tâche')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Nina/ })).toBeInTheDocument()
  })

  it('keeps tasks separate between zones', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openZone(user, 'Hector')
    await addTask(user, 'Acheter du lait')

    await user.click(screen.getByRole('button', { name: 'Hector' }))
    expect(screen.getByRole('button', { name: /^Hector/ })).toHaveTextContent('1 en cours')

    await openZone(user, 'Nina')
    expect(screen.queryByText('Acheter du lait')).not.toBeInTheDocument()
    await addTask(user, 'Arroser les plantes')

    await user.click(screen.getByRole('button', { name: 'Nina' }))
    await openZone(user, 'Hector')
    expect(screen.getByText('Acheter du lait')).toBeInTheDocument()
    expect(screen.queryByText('Arroser les plantes')).not.toBeInTheDocument()
  })

  it('tracks XP separately per zone', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openZone(user, 'Hector')
    await addTask(user, 'Acheter du lait')
    await user.click(screen.getByRole('checkbox'))
    expect(screen.getByText('20/100 XP')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Hector' }))
    await openZone(user, 'Commun')

    expect(screen.getByText('0/100 XP')).toBeInTheDocument()
  })

  it('shows tasks saved before zones existed in the Hector zone', async () => {
    localStorage.setItem(
      'todo-app:v1',
      JSON.stringify([{ id: '1', text: 'Ancienne tâche', createdAt: Date.now(), difficulty: 'easy', done: false }]),
    )
    const user = userEvent.setup()
    render(<App />)

    await openZone(user, 'Nina')
    expect(screen.queryByText('Ancienne tâche')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Nina' }))
    await openZone(user, 'Hector')
    expect(screen.getByText('Ancienne tâche')).toBeInTheDocument()
  })
})

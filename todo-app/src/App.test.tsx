import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('adds a todo and toggles it done', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('New todo'), 'Buy milk')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    const item = screen.getByText('Buy milk')
    expect(item).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox'))
    expect(item.closest('li')).toHaveClass('done')
  })

  it('deletes a todo', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('New todo'), 'Buy milk')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.click(screen.getByRole('button', { name: 'Delete Buy milk' }))

    expect(screen.queryByText('Buy milk')).not.toBeInTheDocument()
  })
})

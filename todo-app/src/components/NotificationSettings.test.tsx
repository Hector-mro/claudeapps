import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NotificationSettings } from './NotificationSettings'

describe('NotificationSettings', () => {
  it('shows nothing when notifications are unavailable', () => {
    const { container } = render(
      <NotificationSettings status="hidden" person={null} onEnable={vi.fn()} onDisable={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('asks whose phone it is, then turns notifications on for them', async () => {
    const user = userEvent.setup()
    const onEnable = vi.fn()
    render(<NotificationSettings status="off" person={null} onEnable={onEnable} onDisable={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Activer les notifications' }))
    expect(screen.getByText(/C'est qui/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Nina' }))

    expect(onEnable).toHaveBeenCalledWith('nina')
  })

  it('says who is notified and can turn it off', async () => {
    const user = userEvent.setup()
    const onDisable = vi.fn()
    render(<NotificationSettings status="on" person="hector" onEnable={vi.fn()} onDisable={onDisable} />)

    expect(screen.getByText(/Notifications activées · Hector/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Désactiver' }))
    expect(onDisable).toHaveBeenCalled()
  })

  it('points iPhone Safari to the home-screen app', () => {
    render(<NotificationSettings status="needs-install" person={null} onEnable={vi.fn()} onDisable={vi.fn()} />)
    expect(screen.getByText(/ajoute l'app à l'écran d'accueil/)).toBeInTheDocument()
  })

  it('offers a retry when turning on failed', () => {
    render(<NotificationSettings status="failed" person={null} onEnable={vi.fn()} onDisable={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
  })
})

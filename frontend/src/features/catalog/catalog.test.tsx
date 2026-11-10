import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { adminCatalogApi } from '@/features/admin/api'
import { sellerProductsApi } from '@/features/seller-portal/api'
import { adminUser, makeUser, renderRoute } from '@/test/renderRoute'
import type { ManagedProduct, ProductCard, ProductDetail } from '@/types/api'
import { catalogApi } from './api'

const card: ProductCard = {
  id: 1,
  slug: 'dried-mangoes-abc12',
  name: 'Dried Mangoes',
  price_from: '1250.5',
  in_stock: true,
  image: null,
  store: { name: 'Aling Rosa', slug: 'aling-rosa', municipality: 'Guihulngan' },
  category: { name: 'Snacks', slug: 'snacks' },
}

const detail: ProductDetail = {
  id: 1,
  slug: card.slug,
  name: 'Dried Mangoes',
  description: 'Sweet and chewy.',
  price_from: '120.00',
  in_stock: true,
  published_at: null,
  images: [],
  variants: [
    { id: 10, name: '250 g', price: '120.00', stock: 0 },
    { id: 11, name: '500 g', price: '220.00', stock: 3 },
  ],
  store: { name: 'Aling Rosa', slug: 'aling-rosa', description: null, municipality: 'Guihulngan', barangay: 'Poblacion', selling_since: null },
  category: { name: 'Snacks', slug: 'snacks' },
}

const page = <T,>(data: T[]) => ({ data, meta: { current_page: 1, last_page: 1, per_page: 24, total: data.length } })

describe('browsing', () => {
  it('shows results with exact peso prices and puts filters in the URL', async () => {
    vi.spyOn(catalogApi, 'categories').mockResolvedValue([
      { id: 1, parent_id: null, name: 'Snacks', slug: 'snacks', position: 0, is_active: true, children: [] },
    ])
    const products = vi.spyOn(catalogApi, 'products').mockResolvedValue(page([card]))
    const { router } = renderRoute('/products?search=mango')

    expect(await screen.findByText('₱1,250.50')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Results for “mango”' })).toBeInTheDocument()
    expect(products).toHaveBeenLastCalledWith({ search: 'mango' })

    await userEvent.click(await screen.findByRole('button', { name: 'Snacks' }))

    await waitFor(() => expect(router.state.location.search).toBe('?search=mango&category=snacks'))
    expect(products).toHaveBeenLastCalledWith({ search: 'mango', category: 'snacks' })
  })

  it('starts on an in-stock option and shows remaining stock', async () => {
    vi.spyOn(catalogApi, 'product').mockResolvedValue(detail)
    renderRoute(`/products/${detail.slug}`)

    expect(await screen.findByText('₱220.00')).toBeInTheDocument()
    expect(screen.getByText('Only 3 left')).toBeInTheDocument()

    await userEvent.click(screen.getByLabelText('250 g'))

    expect(screen.getByText('₱120.00')).toBeInTheDocument()
    expect(screen.getByText('Out of stock')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add to cart/i })).not.toBeInTheDocument()
  })
})

describe('seller portal', () => {
  it('turns away applicants without an approved store', () => {
    renderRoute('/seller/products', { user: makeUser({ seller: { id: 1, store_name: 'Rosa', status: 'pending' } }) })
    expect(screen.getByRole('heading', { name: 'You need an approved store first' })).toBeInTheDocument()
  })

  it('creates a listing and opens it to add photos', async () => {
    vi.spyOn(catalogApi, 'categories').mockResolvedValue([
      { id: 4, parent_id: null, name: 'Snacks', slug: 'snacks', position: 0, is_active: true, children: [] },
    ])
    const created = { id: 42, status: 'draft' } as ManagedProduct
    const create = vi.spyOn(sellerProductsApi, 'create').mockResolvedValue(created)
    vi.spyOn(sellerProductsApi, 'get').mockResolvedValue({
      ...created,
      name: 'Banana Chips',
      slug: 'banana-chips',
      description: 'Crunchy.',
      category_id: 4,
      variants: [],
      images: [],
    } as unknown as ManagedProduct)
    const { router } = renderRoute('/seller/products/new', { user: makeUser({ roles: ['customer', 'seller'], seller: { id: 1, store_name: 'Rosa', status: 'approved' } }) })

    await userEvent.type(screen.getByLabelText('Product name'), 'Banana Chips')
    await userEvent.selectOptions(screen.getByLabelText('Category'), await screen.findByRole('option', { name: 'Snacks' }))
    await userEvent.type(screen.getByLabelText(/Description/), 'Crunchy banana chips.')
    await userEvent.type(screen.getByLabelText('Price (₱)'), '45.50')
    await userEvent.type(screen.getByLabelText('Stock'), '12')
    await userEvent.click(screen.getByRole('button', { name: 'Save and add photos' }))

    expect(create).toHaveBeenCalledWith({
      category_id: 4,
      name: 'Banana Chips',
      description: 'Crunchy banana chips.',
      variants: [{ name: 'Regular', sku: '', price: '45.50', stock: '12' }],
    })
    await waitFor(() => expect(router.state.location.pathname).toBe('/seller/products/42'))
  })
})

describe('moderation', () => {
  it('takes down a live listing with a reason', async () => {
    const live = {
      id: 9,
      name: 'Dried Mangoes',
      slug: 'x',
      description: 'Sweet.',
      status: 'published',
      moderation_reason: null,
      category_id: 1,
      price_from: '120.00',
      stock_total: 3,
      submitted_at: null,
      published_at: null,
      reviewed_at: null,
      updated_at: '2026-11-10T00:00:00Z',
      variants: [],
      images: [],
    } as ManagedProduct
    vi.spyOn(adminCatalogApi, 'product').mockResolvedValue(live)
    const reject = vi.spyOn(adminCatalogApi, 'reject').mockResolvedValue({ ...live, status: 'rejected', moderation_reason: 'Wrong photos.' })
    renderRoute('/admin/products/9', { user: adminUser() })

    await userEvent.click(await screen.findByRole('button', { name: 'Take down' }))
    await userEvent.type(screen.getByLabelText(/What needs to change/), 'Wrong photos.')
    await userEvent.click(screen.getByRole('button', { name: 'Take down Dried Mangoes' }))

    expect(reject).toHaveBeenCalledWith(9, 'Wrong photos.')
    expect(await screen.findByText('Needs changes')).toBeInTheDocument()
  })
})

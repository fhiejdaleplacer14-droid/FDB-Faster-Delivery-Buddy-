import { useEffect, useState, type SubmitEvent } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { firstError, toApiError, type ApiError } from '@/lib/http'
import type { Category } from '@/types/api'
import { adminCatalogApi } from './api'

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[] | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  const reload = () => adminCatalogApi.categories().then(setCategories, (e: unknown) => setError(toApiError(e)))

  useEffect(() => {
    adminCatalogApi.categories().then(setCategories, (e: unknown) => setError(toApiError(e)))
  }, [])

  const parents = (categories ?? []).filter((c) => c.parent_id === null)
  const childrenOf = (id: number) => (categories ?? []).filter((c) => c.parent_id === id)

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight text-heading">Categories</h1>
      <p className="mt-1 text-sm text-slate">Two levels: main categories and subcategories. Turning a category off hides its listings from customers.</p>

      <NewCategoryForm parents={parents} onCreated={reload} />

      {error && (
        <div className="mt-6">
          <Alert tone="error">{error.message}</Alert>
        </div>
      )}
      {categories?.length === 0 && <p className="mt-8 text-sm text-slate">No categories yet. Sellers need at least one to create listings.</p>}

      {parents.length > 0 && (
        <table className="mt-8 w-full text-left text-sm">
          <thead className="border-b border-line text-xs tracking-wide text-slate uppercase">
            <tr>
              <th scope="col" className="py-2 pr-4 font-medium">Name</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">Listings</th>
              <th scope="col" className="py-2 pr-4 font-medium">Shown</th>
              <th scope="col" className="py-2 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {parents.flatMap((parent) => [
              <CategoryRow key={parent.id} category={parent} onChanged={reload} />,
              ...childrenOf(parent.id).map((child) => <CategoryRow key={child.id} category={child} onChanged={reload} indent />),
            ])}
          </tbody>
        </table>
      )}
    </div>
  )
}

function NewCategoryForm({ parents, onCreated }: { parents: Category[]; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await adminCatalogApi.createCategory({ name: name.trim(), parent_id: parentId ? Number(parentId) : null })
      setName('')
      onCreated()
    } catch (e) {
      setError(toApiError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label htmlFor="new-category" className="block text-sm font-medium text-ink">
          New category
        </label>
        <input
          id="new-category"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={firstError(error, 'name') ? true : undefined}
          className="mt-1.5 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm"
        />
        {firstError(error, 'name') && <p className="mt-1 text-sm text-danger">{firstError(error, 'name')}</p>}
      </div>
      <div>
        <label htmlFor="new-category-parent" className="block text-sm font-medium text-ink">
          Inside
        </label>
        <select id="new-category-parent" value={parentId} onChange={(e) => setParentId(e.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm sm:w-48">
          <option value="">Main category</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" busy={busy} disabled={!name.trim()}>
        Add category
      </Button>
    </form>
  )
}

function CategoryRow({ category, onChanged, indent = false }: { category: Category; onChanged: () => void; indent?: boolean }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(category.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(change: Partial<{ name: string; is_active: boolean }>) {
    setBusy(true)
    setError(null)
    try {
      await adminCatalogApi.updateCategory(category.id, {
        name: change.name ?? category.name,
        parent_id: category.parent_id,
        is_active: change.is_active ?? category.is_active,
        position: category.position,
      })
      setEditing(false)
      onChanged()
    } catch (e) {
      const apiError = toApiError(e)
      setError(firstError(apiError, 'name') ?? apiError.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    setError(null)
    try {
      await adminCatalogApi.deleteCategory(category.id)
      onChanged()
    } catch (e) {
      setError(toApiError(e).message)
      setBusy(false)
    }
  }

  return (
    <tr>
      <td className={`py-2 pr-4 ${indent ? 'pl-6' : 'font-medium'}`}>
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void save({ name: name.trim() })
            }}
            className="flex gap-2"
          >
            <label htmlFor={`cat-${category.id}`} className="sr-only">
              Category name
            </label>
            <input id={`cat-${category.id}`} value={name} maxLength={60} autoFocus onChange={(e) => setName(e.target.value)} className="h-8 min-w-0 flex-1 rounded border border-line px-2" />
            <Button type="submit" variant="secondary" className="min-h-8" busy={busy}>
              Save
            </Button>
          </form>
        ) : (
          <span className={category.is_active ? 'text-ink' : 'text-slate line-through'}>{category.name}</span>
        )}
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </td>
      <td className="py-2 pr-4 text-right tabular">{category.products_count ?? 0}</td>
      <td className="py-2 pr-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={category.is_active} disabled={busy} onChange={(e) => save({ is_active: e.target.checked })} className="size-4 accent-blue" />
          <span className="sr-only">Show {category.name} to customers</span>
        </label>
      </td>
      <td className="py-2 text-right whitespace-nowrap">
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className="px-2 text-sm font-medium text-link hover:underline">
            Rename
          </button>
        )}
        {(category.products_count ?? 0) === 0 && (
          <button type="button" onClick={remove} disabled={busy} className="px-2 text-sm font-medium text-danger hover:underline">
            Delete {category.name}
          </button>
        )}
      </td>
    </tr>
  )
}

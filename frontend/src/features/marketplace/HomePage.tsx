const serviceAreas = ['Vallehermoso', 'Guihulngan', 'San Carlos City']

export function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <section className="py-10 sm:py-14">
        <h1 className="max-w-2xl text-3xl font-bold tracking-tight text-navy sm:text-4xl">
          Shop from sellers in your own town.
        </h1>
        <p className="mt-3 max-w-xl text-slate">
          FDB brings local stores together in one place. Sellers set their own prices and deliver
          your orders themselves.
        </p>
        <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-ink">
          {serviceAreas.map((area) => (
            <li key={area} className="border-l-2 border-blue pl-2">
              {area}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="products-heading" className="border-t border-line py-10">
        <h2 id="products-heading" className="text-lg font-semibold text-navy">
          Products
        </h2>
        <p className="mt-2 text-sm text-slate">
          Listings from approved sellers will appear here.
        </p>
      </section>
    </div>
  )
}

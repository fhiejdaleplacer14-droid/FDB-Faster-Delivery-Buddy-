<?php

namespace App\Http\Requests\Catalog;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProductRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'category_id' => ['required', 'integer', Rule::exists('categories', 'id')->where('is_active', true)],
            'name' => ['required', 'string', 'min:3', 'max:120'],
            'description' => ['required', 'string', 'min:10', 'max:5000'],
            'variants' => ['required', 'array', 'min:1', 'max:'.config('fdb.catalog.max_variants')],
            'variants.*.id' => ['nullable', 'integer'],
            'variants.*.name' => ['required', 'string', 'max:60', 'distinct:ignore_case'],
            'variants.*.sku' => ['nullable', 'string', 'max:60', 'regex:/^[A-Za-z0-9._-]+$/'],
            'variants.*.price' => ['required', 'decimal:0,2', 'gte:1', 'lte:1000000'],
            'variants.*.stock' => ['required', 'integer', 'min:0', 'max:100000'],
        ];
    }

    public function messages(): array
    {
        return [
            'category_id.exists' => 'Choose a category from the list.',
            'variants.required' => 'Add at least one option with a price.',
            'variants.*.name.distinct' => 'Each option needs a different name.',
            'variants.*.price.decimal' => 'Enter a price like 120 or 120.50.',
            'variants.*.price.gte' => 'The price must be at least ₱1.',
            'variants.*.sku.regex' => 'Use only letters, numbers, dots, dashes, and underscores.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'name' => trim((string) $this->input('name')),
            'description' => trim((string) $this->input('description')),
        ]);
    }

    /** @return array{category_id: int, name: string, description: string} */
    public function details(): array
    {
        return $this->safe()->only(['category_id', 'name', 'description']);
    }

    /** @return list<array{id: int|null, name: string, sku: string|null, price: string, stock: int}> */
    public function variants(): array
    {
        return collect($this->validated('variants'))
            ->map(fn (array $v) => [
                'id' => isset($v['id']) ? (int) $v['id'] : null,
                'name' => trim($v['name']),
                'sku' => isset($v['sku']) && $v['sku'] !== '' ? $v['sku'] : null,
                // Normalised as a string with bcmath so money never passes through a float.
                'price' => bcadd((string) $v['price'], '0', 2),
                'stock' => (int) $v['stock'],
            ])
            ->values()
            ->all();
    }
}

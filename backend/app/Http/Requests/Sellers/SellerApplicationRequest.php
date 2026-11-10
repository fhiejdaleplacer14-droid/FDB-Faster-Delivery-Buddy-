<?php

namespace App\Http\Requests\Sellers;

use App\Domain\Sellers\BusinessType;
use App\Domain\Sellers\SellerDocumentType;
use App\Domain\Sellers\ServiceArea;
use App\Models\Seller;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class SellerApplicationRequest extends FormRequest
{
    public function rules(): array
    {
        $documents = config('fdb.sellers');

        return [
            'store_name' => ['required', 'string', 'min:3', 'max:80'],
            'description' => ['nullable', 'string', 'max:1000'],
            'contact_phone' => ['required', 'string', 'regex:/^(09|\+639)\d{9}$/'],
            'municipality' => ['required', Rule::enum(ServiceArea::class)],
            'barangay' => ['required', 'string', 'max:100'],
            'address_line' => ['required', 'string', 'max:255'],
            'business_type' => ['required', Rule::enum(BusinessType::class)],
            'business_name' => ['nullable', 'required_if:business_type,registered_business', 'string', 'max:150'],
            'business_registration_number' => ['nullable', 'string', 'max:50', 'regex:/^[A-Za-z0-9\- ]+$/'],
            'documents' => ['array', 'max:'.$documents['max_documents_per_submission']],
            'documents.*.type' => ['required', Rule::enum(SellerDocumentType::class)],
            'documents.*.file' => [
                'required', 'file',
                'mimes:'.implode(',', $documents['document_mimes']),
                'max:'.$documents['document_max_kb'],
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'contact_phone.regex' => 'Enter a Philippine mobile number such as 09171234567.',
            'business_name.required_if' => 'Enter the registered business name.',
            'documents.*.file.mimes' => 'Upload a JPG, PNG, WEBP, or PDF file.',
            'documents.*.file.max' => 'Each file must be 5 MB or smaller.',
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $existing = $this->existingSeller();

            $nameTaken = Seller::query()
                ->where(DB::raw('lower(store_name)'), mb_strtolower((string) $this->input('store_name')))
                ->when($existing, fn ($q) => $q->whereKeyNot($existing->id))
                ->exists();
            if ($nameTaken) {
                $validator->errors()->add('store_name', 'Another store already uses this name.');
            }

            $provided = collect($this->input('documents', []))->pluck('type');
            if ($existing) {
                $provided = $provided->merge($existing->documents()->toBase()->pluck('type'));
            }

            foreach (config('fdb.sellers.required_documents') as $required) {
                if (! $provided->contains($required)) {
                    $label = SellerDocumentType::tryFrom($required)?->label() ?? $required;
                    $validator->errors()->add('documents', "Upload your {$label}.");
                }
            }
        }];
    }

    /** @return array<string, mixed> */
    public function details(): array
    {
        $details = $this->safe()->except('documents');

        if ($details['business_type'] === BusinessType::Individual->value) {
            $details['business_name'] = null;
        }

        return $details;
    }

    /** @return list<array{type: SellerDocumentType, file: UploadedFile}> */
    public function documentUploads(): array
    {
        return collect($this->validated('documents', []))
            ->map(fn (array $doc) => [
                'type' => SellerDocumentType::from($doc['type']),
                'file' => $doc['file'],
            ])
            ->values()
            ->all();
    }

    protected function existingSeller(): ?Seller
    {
        return null;
    }
}

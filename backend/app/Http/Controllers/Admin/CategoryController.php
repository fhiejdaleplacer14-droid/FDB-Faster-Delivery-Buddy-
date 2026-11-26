<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Audit\AuditLogger;
use App\Domain\Identity\PermissionSlug;
use App\Http\Controllers\Controller;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class CategoryController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function index(): AnonymousResourceCollection
    {
        Gate::authorize('permission', PermissionSlug::CategoriesManage);

        return CategoryResource::collection(
            Category::query()->withCount('products')->orderBy('position')->orderBy('name')->get(),
        );
    }

    public function store(Request $request): JsonResponse
    {
        Gate::authorize('permission', PermissionSlug::CategoriesManage);

        $data = $this->validated($request);
        $category = new Category($data);
        $category->slug = $this->uniqueSlug($data['name']);
        $category->save();

        $this->changed('category.created', $request, $category);

        return (new CategoryResource($category->loadCount('products')))->response()->setStatusCode(201);
    }

    public function update(Request $request, Category $category): CategoryResource
    {
        Gate::authorize('permission', PermissionSlug::CategoriesManage);

        $data = $this->validated($request, $category);
        if ($category->isOthers() && (($data['parent_id'] ?? null) || ($data['is_active'] ?? true) === false)) {
            abort(response()->json(['message' => 'Others holds listings that fit nowhere else. It stays on and top-level.'], 409));
        }
        if (($data['parent_id'] ?? null) && $category->children()->exists()) {
            abort(response()->json(['message' => 'A category with subcategories cannot become a subcategory.'], 409));
        }

        $category->fill($data);
        if ($category->isDirty('name')) {
            $category->slug = $this->uniqueSlug($data['name'], $category->id);
        }
        $category->save();

        $this->changed('category.updated', $request, $category);

        return new CategoryResource($category->loadCount('products'));
    }

    public function destroy(Request $request, Category $category): Response|JsonResponse
    {
        Gate::authorize('permission', PermissionSlug::CategoriesManage);

        if ($category->isOthers() || $category->children()->exists() || $category->products()->withTrashed()->exists()) {
            return response()->json([
                'message' => 'This category still has subcategories or listings. Turn it off instead of deleting it.',
            ], 409);
        }

        DB::transaction(function () use ($request, $category) {
            $this->changed('category.deleted', $request, $category);
            $category->delete();
        });

        return response()->noContent();
    }

    /** @return array<string, mixed> */
    private function validated(Request $request, ?Category $category = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:60'],
            // Two levels only: a parent must itself be a top-level category.
            'parent_id' => [
                'nullable', 'integer',
                Rule::exists('categories', 'id')->whereNull('parent_id'),
                Rule::notIn(array_filter([$category?->id])),
            ],
            'position' => ['nullable', 'integer', 'min:0', 'max:1000'],
            'is_active' => ['nullable', 'boolean'],
        ]);
    }

    private function changed(string $action, Request $request, Category $category): void
    {
        Cache::forget(Category::TREE_CACHE_KEY);
        $this->audit->record($action, $request->user(), $category, ['name' => $category->name]);
    }

    private function uniqueSlug(string $name, ?int $ignoreId = null): string
    {
        $base = Str::slug($name) ?: 'category';
        $slug = $base;
        $i = 2;

        while (Category::query()->where('slug', $slug)->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))->exists()) {
            $slug = $base.'-'.$i++;
        }

        return $slug;
    }
}

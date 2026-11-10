<?php

namespace App\Http\Requests\Sellers;

use App\Models\Seller;

class ResubmitSellerApplicationRequest extends SellerApplicationRequest
{
    protected function existingSeller(): ?Seller
    {
        return Seller::query()->where('user_id', $this->user()->id)->first();
    }
}

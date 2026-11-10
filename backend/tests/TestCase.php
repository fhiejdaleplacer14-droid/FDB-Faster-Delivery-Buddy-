<?php

namespace Tests;

use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected bool $seed = true;

    protected string $seeder = DatabaseSeeder::class;

    protected function setUp(): void
    {
        parent::setUp();

        // Sanctum only starts a session for requests coming from the SPA, as the browser would send.
        $this->withHeader('Referer', config('app.frontend_url').'/');
    }
}

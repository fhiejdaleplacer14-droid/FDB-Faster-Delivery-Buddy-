<?php

it('lets every request through when no edge secret is set', function () {
    config(['fdb.edge_secret' => null]);

    $this->getJson('/api/v1/categories')->assertOk();
});

it('refuses requests that did not come through the website', function () {
    config(['fdb.edge_secret' => 'worker-secret']);

    $this->getJson('/api/v1/categories')->assertForbidden();
    $this->getJson('/api/v1/categories', ['X-FDB-Edge' => 'wrong'])->assertForbidden();
    $this->getJson('/api/v1/categories', ['X-FDB-Edge' => 'worker-secret'])->assertOk();
});

it('keeps the health check open for the host', function () {
    config(['fdb.edge_secret' => 'worker-secret']);

    $this->getJson('/api/v1/health')->assertOk();
});

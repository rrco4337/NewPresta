<?php

if (!defined('_PS_VERSION_')) {
    exit;
}

class StockApi extends Module
{
    public function __construct()
    {
        $this->name = 'stockapi';
        $this->tab = 'administration';
        $this->version = '1.0.0';
        $this->author = 'Custom';
        $this->need_instance = 0;

        parent::__construct();

        $this->displayName = $this->l('Stock API');
        $this->description = $this->l('Endpoint XML unique pour mise à jour de stock par delta');
    }

    public function install(): bool
    {
        Configuration::updateValue(
            'STOCKAPI_SECRET_KEY',
            bin2hex(random_bytes(16))
        );

        return parent::install();
    }

    public function uninstall(): bool
    {
        Configuration::deleteByName('STOCKAPI_SECRET_KEY');

        return parent::uninstall();
    }
}
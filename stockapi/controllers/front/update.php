<?php

class StockapiUpdateModuleFrontController extends ModuleFrontController
{
    public $ajax = true;

    public function init(): void
    {
        // 1. Headers CORS complets
        header('Access-Control-Allow-Origin: http://localhost:5173');
        header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, X-Api-Key, Authorization');
        header('Access-Control-Allow-Credentials: true');

        // 2. Réponse spécifique pour OPTIONS (Preflight)
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            // On renvoie 200 au lieu de 204 pour plus de compatibilité en local
            http_response_code(200);
            exit;
        }

        parent::init();
    }

    public function initContent(): void
    {
        header('Content-Type: application/xml; charset=utf-8');

        // On vérifie la méthode APRES le parent::init()
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->xmlError(405, 'Method Not Allowed');
        }

        // --- Authentification ---
        $secret = Configuration::get('STOCKAPI_SECRET_KEY');
        // On vérifie plusieurs sources pour le header (certains serveurs le renomment)
        $headerKey = $_SERVER['HTTP_X_API_KEY'] ?? $_SERVER['X_Api-Key'] ?? '';

        if (!$secret || !hash_equals($secret, $headerKey)) {
            $this->xmlError(401, 'Unauthorized');
        }

        // --- Traitement du XML ---
        $rawBody = file_get_contents('php://input');
        if (empty($rawBody)) {
            $this->xmlError(400, 'Empty body');
        }

        libxml_use_internal_errors(true);
        $xml = simplexml_load_string($rawBody);

        if ($xml === false) {
            $this->xmlError(400, 'Invalid XML');
        }

        $node = $xml->stock_update;
        $idProduct = (int) ($node->id_product ?? 0);
        $idProductAttribute = (int) ($node->id_product_attribute ?? 0);
        $delta = (int) ($node->delta ?? 0);

        if ($idProduct <= 0 || $delta === 0) {
            $this->xmlError(400, 'Invalid parameters');
        }

        // Mise à jour effective
        StockAvailable::updateQuantity($idProduct, $idProductAttribute, $delta);
        $newQty = (int) StockAvailable::getQuantityAvailableByProduct($idProduct, $idProductAttribute);

        echo $this->buildXml([
            'success' => 1,
            'id_product' => $idProduct,
            'id_product_attribute' => $idProductAttribute,
            'new_quantity' => $newQty,
        ]);

        exit;
    }

    private function buildXml(array $fields): string
    {
        $dom = new DOMDocument('1.0', 'UTF-8');
        $dom->formatOutput = true;
        $root = $dom->createElement('prestashop');
        $parent = $dom->createElement('stock_update');
        foreach ($fields as $tag => $value) {
            $el = $dom->createElement($tag);
            $el->appendChild($dom->createCDATASection((string) $value));
            $parent->appendChild($el);
        }
        $root->appendChild($parent);
        $dom->appendChild($root);
        return $dom->saveXML();
    }

    private function xmlError(int $code, string $msg): void
    {
        http_response_code($code);
        echo $this->buildXml(['success' => 0, 'error' => $msg]);
        exit;
    }
}
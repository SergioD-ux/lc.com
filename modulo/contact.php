<?php
declare(strict_types=1);
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function respond(int $code, bool $ok, string $message): void {
    http_response_code($code);
    if (strpos($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json') !== false) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => $ok, 'message' => $message], JSON_UNESCAPED_UNICODE);
    } else {
        header('Content-Type: text/html; charset=utf-8');
        $safe = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
        echo '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Contacto | Leyva Consultores</title><link rel="stylesheet" href="../css/brand.css"></head><body><main class="wrap section prose"><p class="eyebrow">LEYVA CONSULTORES</p><h1>Tu consulta</h1><p>' . $safe . '</p><a class="button primary" href="../contacto.html">Volver a contacto</a></main></body></html>';
    }
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST'); respond(405, false, 'Utiliza el formulario de contacto para enviar una consulta.');
}
if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 20000) respond(413, false, 'La consulta es demasiado extensa. Reduce el mensaje e inténtalo de nuevo.');
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '') {
    $originHost = strtolower((string)parse_url($origin, PHP_URL_HOST));
    $requestHost = strtolower(explode(':', $_SERVER['HTTP_HOST'] ?? '')[0]);
    if ($originHost === '' || $originHost !== $requestHost) respond(403, false, 'Envía tu consulta desde el formulario de esta web.');
}
$values = [];
foreach (['name', 'email', 'subject', 'message', 'consent', 'website', 'channel'] as $field) {
    if (isset($_POST[$field]) && !is_string($_POST[$field])) respond(422, false, 'Revisa los campos de tu consulta.');
    $values[$field] = trim($_POST[$field] ?? '');
}
if ($values['website'] !== '') respond(422, false, 'No se pudo procesar la consulta.');
if ($values['consent'] !== 'yes') respond(422, false, 'Debes autorizar el uso de tus datos para atender la consulta.');
foreach (['name' => 400, 'email' => 254, 'subject' => 600, 'message' => 12000] as $field => $maxBytes) {
    if ($values[$field] === '' || strlen($values[$field]) > $maxBytes || preg_match('//u', $values[$field]) !== 1 || strpos($values[$field], "\0") !== false) respond(422, false, 'Revisa que todos los campos estén completos y dentro del límite de longitud.');
}
if (!filter_var($values['email'], FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $values['email'] . $values['name'] . $values['subject'])) respond(422, false, 'Introduce un nombre, asunto y correo válidos.');
if (strlen($values['message']) < 10) respond(422, false, 'Cuéntanos un poco más sobre tu proyecto.');
if ($values['channel'] === 'whatsapp') {
    $message = "Hola, soy {$values['name']}.\nCorreo: {$values['email']}\nServicio: {$values['subject']}\n\n{$values['message']}";
    header('Location: https://wa.me/51969200366?text=' . rawurlencode($message), true, 303); exit;
}
// Locked rate-limit bucket; message contents are never stored in this file.
$bucket = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'lc-contact-' . hash('sha256', __DIR__ . '|' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown')) . '.json';
$handle = @fopen($bucket, 'c+');
if ($handle === false || !flock($handle, LOCK_EX)) respond(503, false, 'El correo no está disponible en este momento. Puedes contactarnos por WhatsApp.');
$now = time(); $attempts = json_decode(stream_get_contents($handle), true);
$attempts = is_array($attempts) ? array_values(array_filter($attempts, static function ($t) use ($now) { return is_int($t) && $t > $now - 3600; })) : [];
if (count($attempts) >= 5 || ($attempts && $now - end($attempts) < 60)) {
    flock($handle, LOCK_UN); fclose($handle); header('Retry-After: 60');
    respond(429, false, 'Espera un momento antes de volver a enviar. También puedes escribirnos por WhatsApp.');
}
$attempts[] = $now;
rewind($handle); ftruncate($handle, 0); fwrite($handle, json_encode($attempts)); fflush($handle); flock($handle, LOCK_UN); fclose($handle);
$recipient = 'comercial@lc.com.pe';
$sender = getenv('CONTACT_FROM') ?: 'comercial@lc.com.pe';
if (!filter_var($sender, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $sender) || !function_exists('mail')) respond(503, false, 'El correo no está disponible en este momento. Puedes contactarnos por WhatsApp.');
$body = "Consulta desde Leyva Consultores\n\nNombre: {$values['name']}\nCorreo: {$values['email']}\nServicio: {$values['subject']}\n\n{$values['message']}\n\nAutorizó el uso de datos para responder su consulta.";
$headers = ['From' => 'Leyva Consultores <' . $sender . '>', 'Reply-To' => $values['email'], 'MIME-Version' => '1.0', 'Content-Type' => 'text/plain; charset=UTF-8'];
$accepted = @mail($recipient, 'Consulta desde la web de Leyva Consultores', $body, $headers);
if (!$accepted) respond(503, false, 'No se pudo enviar tu consulta. Puedes reintentar o continuar por WhatsApp.');
respond(200, true, 'El servidor aceptó tu consulta para envío. Gracias por contactarnos.');

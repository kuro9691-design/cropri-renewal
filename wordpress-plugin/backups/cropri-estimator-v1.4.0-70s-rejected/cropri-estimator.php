<?php
/**
 * Plugin Name: CROPRI Estimator
 * Description: お客様が操作する見積もり画面(シルク／DTG／DTF)。ショートコード [cropri_estimator]。見積もり依頼は非公開で保存し、管理者にだけメールで届ける。原価・利益は持たない。
 * Version: 1.4.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 */

if (! defined('ABSPATH')) {
	exit;
}

define('CROPRI_ESTIMATOR_VERSION', '1.4.0');
define('CROPRI_ESTIMATOR_CPT', 'cropri_quote_req');
/** 見積もり依頼メールの宛先(2026-10-09 ユーザー指定) */
define('CROPRI_ESTIMATOR_MAIL_TO', 'kurokui@cropri.com');

/* ---------- 見積もり依頼の保存先(非公開・管理者だけ) ---------- */

function cropri_estimator_register_cpt() {
	register_post_type(CROPRI_ESTIMATOR_CPT, array(
		'labels'              => array(
			'name'          => '見積もり依頼',
			'singular_name' => '見積もり依頼',
			'menu_name'     => '見積もり依頼',
		),
		'public'              => false,
		'publicly_queryable'  => false,
		'exclude_from_search' => true,
		'show_in_rest'        => false,
		'show_in_nav_menus'   => false,
		'show_ui'             => true,
		'show_in_menu'        => true,
		'menu_icon'           => 'dashicons-email-alt',
		'supports'            => array('title', 'editor'),
		'capability_type'     => array('cropri_qr', 'cropri_qrs'),
		'map_meta_cap'        => true,
		'capabilities'        => array('create_posts' => 'do_not_allow'),
		'rewrite'             => false,
		'query_var'           => false,
	));
}
add_action('init', 'cropri_estimator_register_cpt');

/** 依頼を見られるのは管理者だけ(編集者・投稿者には権限を付けない)。 */
function cropri_estimator_admin_caps() {
	$role = get_role('administrator');
	if (! $role || $role->has_cap('edit_others_cropri_qrs')) {
		return;
	}
	foreach (array('edit_cropri_qrs', 'edit_others_cropri_qrs', 'edit_private_cropri_qrs', 'edit_published_cropri_qrs', 'read_private_cropri_qrs', 'delete_cropri_qrs', 'delete_others_cropri_qrs', 'delete_private_cropri_qrs', 'delete_published_cropri_qrs', 'publish_cropri_qrs') as $cap) {
		$role->add_cap($cap);
	}
}
add_action('admin_init', 'cropri_estimator_admin_caps');
register_activation_hook(__FILE__, 'cropri_estimator_admin_caps');

/* ---------- 受付(REST) ---------- */

function cropri_estimator_rest() {
	register_rest_route('cropri/v1', '/quote-request', array(
		'methods'             => 'POST',
		'callback'            => 'cropri_estimator_receive',
		'permission_callback' => '__return_true',
	));
}
add_action('rest_api_init', 'cropri_estimator_rest');

function cropri_estimator_fail($message, $status = 400) {
	return new WP_REST_Response(array('ok' => false, 'message' => $message), $status);
}

function cropri_estimator_receive(WP_REST_Request $req) {
	$p = $req->get_json_params();
	if (! is_array($p)) {
		return cropri_estimator_fail('送信内容を読み取れませんでした。');
	}
	// 迷惑送信よけ(人には見えない欄に入力があれば、受け付けたふりをして捨てる)
	if (! empty($p['website'])) {
		return new WP_REST_Response(array('ok' => true), 200);
	}

	$name    = sanitize_text_field(mb_substr((string) ($p['name'] ?? ''), 0, 100));
	$email   = sanitize_email((string) ($p['email'] ?? ''));
	$tel     = sanitize_text_field(mb_substr((string) ($p['tel'] ?? ''), 0, 30));
	$message = sanitize_textarea_field(mb_substr((string) ($p['message'] ?? ''), 0, 2000));
	$summary = sanitize_textarea_field(mb_substr((string) ($p['summary'] ?? ''), 0, 6000));
	$total   = (int) ($p['total'] ?? 0);
	$qty     = (int) ($p['qty'] ?? 0);
	$method  = sanitize_key((string) ($p['method'] ?? ''));

	if ('' === $name || ! is_email($email)) {
		return cropri_estimator_fail('お名前とメールアドレスを確認してください。');
	}
	if ($qty < 1 || $qty > 499 || '' === $summary) {
		return cropri_estimator_fail('見積もりの内容を確認してください。');
	}

	// 同じ接続元からの連続送信を制限(1時間に5件まで)
	$ip_key = 'cropri_qr_' . md5((string) ($_SERVER['REMOTE_ADDR'] ?? ''));
	$count  = (int) get_transient($ip_key);
	if ($count >= 5) {
		return cropri_estimator_fail('送信が続いたため、しばらく受け付けを止めています。', 429);
	}
	set_transient($ip_key, $count + 1, HOUR_IN_SECONDS);

	// freee用の明細(シルクのみ)。値は画面の計算そのままなので、正式な見積書は cropri_quote.py で計算し直す。
	$lines = array();
	if (! empty($p['lines']) && is_array($p['lines'])) {
		foreach (array_slice($p['lines'], 0, 40) as $l) {
			$lines[] = array(
				'description' => sanitize_text_field(mb_substr((string) ($l['description'] ?? ''), 0, 120)),
				'quantity'    => (float) ($l['quantity'] ?? 0),
				'unit'        => sanitize_text_field(mb_substr((string) ($l['unit'] ?? ''), 0, 10)),
				'unit_price'  => (int) ($l['unit_price'] ?? 0),
			);
		}
	}

	$body = "■ お名前: {$name}\n■ メール: {$email}\n■ 電話: " . ('' !== $tel ? $tel : '—') . "\n\n■ ご要望\n" . ('' !== $message ? $message : '—') . "\n\n" . $summary;

	$post_id = wp_insert_post(array(
		'post_type'    => CROPRI_ESTIMATOR_CPT,
		'post_status'  => 'private',
		'post_title'   => sprintf('%s %s様 %d枚 %s円', wp_date('Y-m-d H:i'), $name, $qty, number_format($total)),
		'post_content' => $body,
	), true);
	if (is_wp_error($post_id)) {
		return cropri_estimator_fail('受け付けられませんでした。', 500);
	}
	update_post_meta($post_id, '_cropri_email', $email);
	update_post_meta($post_id, '_cropri_tel', $tel);
	update_post_meta($post_id, '_cropri_method', $method);
	update_post_meta($post_id, '_cropri_total', $total);
	update_post_meta($post_id, '_cropri_lines', wp_json_encode($lines, JSON_UNESCAPED_UNICODE));

	$admin_url = admin_url('post.php?post=' . $post_id . '&action=edit');
	$mail_error = '';
	$on_fail    = function ($err) use (&$mail_error) {
		$mail_error = $err instanceof WP_Error ? $err->get_error_message() : 'unknown';
	};
	add_action('wp_mail_failed', $on_fail);
	$sent = wp_mail(
		CROPRI_ESTIMATOR_MAIL_TO,
		sprintf('[cropri] 見積もり依頼 %s様(%d枚)', $name, $qty),
		$body . "\n\n管理画面: " . $admin_url,
		array('Reply-To: ' . $name . ' <' . $email . '>')
	);
	remove_action('wp_mail_failed', $on_fail);
	// メールが届かないときの調査用(管理画面のカスタムフィールドで見られる)
	update_post_meta($post_id, '_cropri_mail', $sent ? 'sent' : ('failed: ' . $mail_error));

	return new WP_REST_Response(array('ok' => true), 200);
}

/* ---------- 画面 ---------- */

function cropri_estimator_shortcode() {
	$base = plugin_dir_url(__FILE__);
	wp_enqueue_style('cropri-estimator-font', 'https://fonts.googleapis.com/css2?family=Anton&family=Noto+Sans+JP:wght@400;500;700;900&display=swap', array(), null);
	wp_enqueue_style('cropri-estimator', $base . 'assets/estimator.css', array(), CROPRI_ESTIMATOR_VERSION);
	wp_enqueue_script('cropri-estimator', $base . 'assets/estimator.js', array(), CROPRI_ESTIMATOR_VERSION, true);
	wp_add_inline_script('cropri-estimator', 'window.CROPRI_ESTIMATOR=' . wp_json_encode(array('endpoint' => rest_url('cropri/v1/quote-request'))) . ';', 'before');

	$markup = file_get_contents(plugin_dir_path(__FILE__) . 'estimator-markup.html');
	return false === $markup ? '' : $markup;
}
add_shortcode('cropri_estimator', 'cropri_estimator_shortcode');

/* ---------- 5001商品詳細ページ ---------- */

function cropri_5001_product_shortcode() {
	$base = plugin_dir_url(__FILE__);
	wp_enqueue_style('cropri-estimator-font', 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap', array(), null);
	wp_enqueue_style('cropri-5001-product', $base . 'assets/product-5001.css', array(), CROPRI_ESTIMATOR_VERSION);

	$markup = file_get_contents(plugin_dir_path(__FILE__) . '5001-product-markup.html');
	return false === $markup ? '' : $markup;
}
add_shortcode('cropri_5001_product', 'cropri_5001_product_shortcode');

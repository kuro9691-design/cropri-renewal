<?php
/**
 * Plugin Name: CROPRI Estimator
 * Description: お客様が操作する見積もり画面(シルク／DTG／DTF)。ショートコード [cropri_estimator]。見積もり依頼は非公開で保存し、管理者にだけメールで届ける。原価・利益は持たない。
 * Version: 1.8.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 */

if (! defined('ABSPATH')) {
	exit;
}

define('CROPRI_ESTIMATOR_VERSION', '1.8.0');
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
	wp_enqueue_style('cropri-estimator-font', 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap', array(), null);
	wp_enqueue_style('cropri-estimator', $base . 'assets/estimator.css', array(), CROPRI_ESTIMATOR_VERSION);
	wp_enqueue_script('cropri-estimator', $base . 'assets/estimator.js', array(), CROPRI_ESTIMATOR_VERSION, true);
	wp_enqueue_script('cropri-estimator-handoff', $base . 'assets/estimator-handoff.js', array('cropri-estimator'), CROPRI_ESTIMATOR_VERSION, true);
	wp_add_inline_script('cropri-estimator', 'window.CROPRI_ESTIMATOR=' . wp_json_encode(array('endpoint' => rest_url('cropri/v1/quote-request'))) . ';', 'before');
	wp_add_inline_script('cropri-estimator', 'window.CROPRI_5001_COLORS=' . wp_json_encode(cropri_5001_colors(), JSON_UNESCAPED_UNICODE) . ';', 'before');

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

/* ---------- 商品選択UI（Elementorの画像ギャラリーと独立配置） ---------- */
function cropri_5001_colors() {
	return array(
		'0001'=>'ホワイト','0002'=>'ブラック','0005'=>'アッシュ','0006'=>'ミックスグレー','0007'=>'チャコール','0009'=>'オートミール','0010'=>'ライトグレー','0016'=>'アイボリー','0019'=>'ナチュラル','0021'=>'イエロー','0022'=>'ゴールド','0024'=>'ミントグリーン','0029'=>'グリーン','0035'=>'シティグリーン','0037'=>'メロン','0052'=>'ダークブラウン','0053'=>'ライトベージュ','0062'=>'パープル','0064'=>'オレンジ','0066'=>'ピンク','0069'=>'レッド','0072'=>'バーガンディ','0076'=>'ラベンダー','0082'=>'サックス','0083'=>'アクアブルー','0085'=>'ロイヤルブルー','0086'=>'ネイビー','0087'=>'インディゴ','0088'=>'スレート','0165'=>'SUMI','0183'=>'グレージュ','0190'=>'カナリアイエロー','0191'=>'バニラホワイト','0232'=>'ハイレッド','0247'=>'アシッドブルー','0369'=>'BANANA','0487'=>'ライトイエロー','0488'=>'ライトブルー','0494'=>'ライトパープル','0495'=>'ライトピンク','0497'=>'アイビーグリーン','0511'=>'トロピカルピンク','0537'=>'サンドカーキ','0538'=>'ターコイズブルー','0539'=>'バイオレットパープル','0545'=>'サンドベージュ','0574'=>'アプリコット','0575'=>'アップルグリーン','0576'=>'ベビーピンク','0584'=>'ダークヘザーネイビー','0717'=>'ダークネイビー','0725'=>'ヘザーブラック','0739'=>'ライトオリーブ','0933'=>'ヘイジーブラック','0934'=>'ヘイジーネイビー','0935'=>'ヘイジーグリーン','0943'=>'グレイッシュパープル','0944'=>'グレイッシュグリーン','0954'=>'ヘイジーパープル','0955'=>'ヘイジーオレンジ','0956'=>'ヘイジーブルー'
	);
}

function cropri_product_selector_shortcode($raw_atts) {
	$atts = shortcode_atts(array(
		'sku' => '5001-01', 'title' => '5.6oz ハイクオリティーTシャツ',
		'estimate_url' => '/estimate/', 'size_url' => '',
		'gallery' => '', 'color_images' => '',
	), $raw_atts, 'cropri_product_selector');
	if ('5001-01' !== $atts['sku']) return '';
	$colors = cropri_5001_colors();
	$image_ids = array();
	foreach (explode(',', $atts['color_images']) as $pair) {
		$parts = array_map('trim', explode(':', $pair, 2));
		if (2 !== count($parts) || ! isset($colors[$parts[0]])) continue;
		$id = absint($parts[1]);
		if ($id && wp_get_attachment_image_url($id, 'large')) {
			$image_ids[$parts[0]] = array(
				'view' => wp_get_attachment_image_url($id, 'large'),
				'full' => wp_get_attachment_image_url($id, 'full'),
			);
		}
	}
	$estimate_url = esc_url_raw($atts['estimate_url']);
	$size_url = '' !== $atts['size_url'] ? esc_url_raw($atts['size_url']) : get_permalink() . '#cp5001-size';
	if (!$estimate_url || !$size_url) return '';
	$base = plugin_dir_url(__FILE__);
	wp_enqueue_style('cropri-product-selector', $base . 'assets/product-selector.css', array(), CROPRI_ESTIMATOR_VERSION);
	wp_enqueue_script('cropri-product-selector', $base . 'assets/product-selector.js', array(), CROPRI_ESTIMATOR_VERSION, true);
	$stock_data = json_decode((string) file_get_contents(plugin_dir_path(__FILE__) . 'assets/stock-5001.json'), true);
	if (! is_array($stock_data) || ! isset($stock_data['source_created_at'], $stock_data['stock'])) return '';
	wp_add_inline_script('cropri-product-selector', 'window.CROPRI_5001_STOCK=' . wp_json_encode($stock_data, JSON_UNESCAPED_UNICODE) . ';', 'before');
	$id = wp_unique_id('cropri-selector-');
	$stock_id = $id . '-stock';
	$colors_id = $id . '-colors';
	ob_start(); ?>
	<section id="<?php echo esc_attr($id); ?>" class="cropri-product-selector" data-sku="5001-01" data-estimate="<?php echo esc_url($estimate_url); ?>" data-gallery="<?php echo esc_attr($atts['gallery']); ?>" aria-label="商品仕様を選ぶ">
		<div class="cps-summary">
		<p class="cps-eyebrow">UNITED ATHLE / 5001-01</p>
		<h2><?php echo esc_html($atts['title']); ?></h2>
		<p class="cps-price"><strong data-price>957</strong><span>円（税込） / 無地1枚</span></p>
		<p class="cps-note">プリント代は見積もり画面で計算します。</p>
		<div class="cps-divider"></div>
		<div class="cps-head cps-size-head"><h3>サイズ</h3><a href="<?php echo esc_url($size_url); ?>" target="_blank" rel="noopener noreferrer">📏 実寸表を見る ↗</a></div>
		<div class="cps-sizes" role="group" aria-label="サイズを選ぶ"><?php foreach (array('S','M','L','XL','XXL','XXXL') as $size) : ?><button type="button" data-size="<?php echo esc_attr($size); ?>" aria-pressed="<?php echo 'M' === $size ? 'true' : 'false'; ?>" class="<?php echo 'M' === $size ? 'is-selected' : ''; ?>"><?php echo esc_html($size); ?></button><?php endforeach; ?></div>
		<label class="cps-quantity">数量 <span><input type="number" min="1" max="499" step="1" inputmode="numeric" value="1" data-quantity> 枚</span></label>
		<a class="cps-cta" href="<?php echo esc_url($estimate_url); ?>" data-cta>この内容で見積もる <span aria-hidden="true">→</span></a>
		<p class="cps-note">色写真からサイズ別在庫を確認できます。表示数は週次更新の参考値です。</p>
		</div>
		<div class="cps-color-section">
		<div class="cps-head"><h3>カラー <small>全<?php echo count($colors); ?>色</small></h3><span class="cps-picked" aria-live="polite"><span data-color-name>ブラック</span> <span data-color-code>0002</span></span></div>
		<div id="<?php echo esc_attr($colors_id); ?>" class="cps-colors" role="group" aria-label="カラーを選ぶ">
		<?php foreach ($colors as $code => $name) : $image = isset($image_ids[$code]) ? $image_ids[$code] : array('view' => $base . 'assets/5001-images/view/' . $code . '.jpg', 'full' => $base . 'assets/5001-images/view/' . $code . '.jpg'); ?>
		<button type="button" class="cps-color<?php echo '0002' === $code ? ' is-selected' : ''; ?>" data-code="<?php echo esc_attr($code); ?>" data-name="<?php echo esc_attr($name); ?>" data-view="<?php echo esc_url($image['view']); ?>" data-full="<?php echo esc_url($image['full']); ?>" aria-pressed="<?php echo '0002' === $code ? 'true' : 'false'; ?>" aria-haspopup="dialog" aria-controls="<?php echo esc_attr($stock_id); ?>" aria-label="<?php echo esc_attr($name . ' ' . $code . ' の在庫を確認'); ?>" title="<?php echo esc_attr($name . ' ' . $code); ?>"><img src="<?php echo esc_url($base . 'assets/5001-images/thumb/' . $code . '.jpg'); ?>" alt="" width="110" height="110" loading="lazy"><span class="cps-color-name"><?php echo esc_html($name); ?></span><span class="cps-color-code"><?php echo esc_html($code); ?></span></button>
		<?php endforeach; ?>
		</div>
		<button type="button" class="cps-color-toggle" data-color-toggle aria-controls="<?php echo esc_attr($colors_id); ?>" aria-expanded="false" hidden>カラーをもっと見る</button>
		<p class="cps-photo-note" data-photo-note>写真はブラックの参考画像です。画面上の色味は実物と異なる場合があります。</p>
		</div>
		<div class="cps-stock" hidden data-stock-modal>
			<div class="cps-stock-backdrop" data-stock-backdrop></div>
			<div id="<?php echo esc_attr($stock_id); ?>" class="cps-stock-panel" role="dialog" aria-modal="true" aria-labelledby="<?php echo esc_attr($stock_id); ?>-title" aria-describedby="<?php echo esc_attr($stock_id); ?>-note">
				<button type="button" class="cps-stock-close" data-stock-close aria-label="在庫表を閉じる">×</button>
				<p class="cps-stock-kicker">5001-01 / COLOR STOCK</p>
				<h3 id="<?php echo esc_attr($stock_id); ?>-title"><span data-stock-code>0002</span> <span data-stock-name>ブラック</span></h3>
				<div class="cps-stock-nav"><button type="button" data-stock-prev>← 前の色</button><button type="button" data-stock-next>次の色 →</button></div>
				<p class="cps-stock-instruction">サイズを選ぶと、下の見積もりにも反映されます。</p>
				<table class="cps-stock-table"><thead><tr><th scope="col">サイズ</th><th scope="col">在庫数</th></tr></thead><tbody>
				<?php foreach (array('S','M','L','XL','XXL','XXXL') as $stock_size) : ?><tr><th scope="row"><button type="button" data-stock-size="<?php echo esc_attr($stock_size); ?>" aria-pressed="false"><?php echo esc_html($stock_size); ?></button></th><td data-stock-count="<?php echo esc_attr($stock_size); ?>">—</td></tr><?php endforeach; ?>
				</tbody></table>
				<label class="cps-stock-quantity">見積もり希望枚数 <span><input type="number" min="1" max="499" step="1" inputmode="numeric" value="1" data-stock-quantity> 枚</span></label>
				<p id="<?php echo esc_attr($stock_id); ?>-note" class="cps-stock-note">CSV作成日時：<?php echo esc_html($stock_data['source_created_at']); ?><br>在庫データは週次更新です。リアルタイム在庫ではなく、現在の在庫・確保を保証しません。</p>
				<a class="cps-stock-cta" href="<?php echo esc_url($estimate_url); ?>" data-stock-cta>この内容で見積もる →</a>
			</div>
		</div>
	</section>
	<?php return ob_get_clean();
}
add_shortcode('cropri_product_selector', 'cropri_product_selector_shortcode');

/* ---------- 商品詳細下部のコンパクト概算 ---------- */
function cropri_compact_estimator_shortcode($raw_atts) {
	$atts = shortcode_atts(array('estimate_url' => '/estimate/'), $raw_atts, 'cropri_compact_estimator');
	$estimate_url = esc_url_raw($atts['estimate_url']);
	if (! $estimate_url) return '';
	$engine = cropri_estimator_shortcode();
	if ('' === $engine) return '';
	wp_enqueue_style('cropri-compact-estimator', plugin_dir_url(__FILE__) . 'assets/compact-estimator.css', array('cropri-estimator'), CROPRI_ESTIMATOR_VERSION);
	wp_enqueue_script('cropri-compact-estimator', plugin_dir_url(__FILE__) . 'assets/compact-estimator.js', array('cropri-estimator'), CROPRI_ESTIMATOR_VERSION, true);
	ob_start(); ?>
	<section class="cq-compact" data-estimate-url="<?php echo esc_url($estimate_url); ?>" aria-label="5001のプリント概算見積もり">
		<div class="cq-compact-head"><p>PRINT ESTIMATE / 5001-01</p><h2>プリント概算見積もり</h2><p>2項目を選ぶと概算金額が表示され、その条件を引き継いでお問い合わせできます。</p></div>
		<div class="cq-compact-grid">
			<div class="cq-compact-questions">
				<div class="cq-compact-question"><h3><span>01</span> 商品数量</h3><p data-compact-product>5001-01 アダルト / ブラック / M</p><label>希望枚数 <span><input type="number" min="1" max="149" step="1" inputmode="numeric" value="" placeholder="例：30" data-compact-qty> 枚</span></label><small>選択中の商品色・サイズを使います。概算表示は1〜149枚。<a href="<?php echo esc_url($estimate_url); ?>" data-compact-large-link>150枚以上はこちら（詳細見積）→</a></small></div>
				<div class="cq-compact-question"><h3><span>02</span> プリント位置・色数</h3><p>シルクスクリーン印刷・1か所の概算（表面・裏面は通常サイズ）</p><div class="cq-compact-positions" role="group" aria-label="プリント位置"><button type="button" data-compact-pos="front" aria-pressed="true">表面</button><button type="button" data-compact-pos="back" aria-pressed="false">裏面</button><button type="button" data-compact-pos="rsleeve" aria-pressed="false">右そで</button><button type="button" data-compact-pos="lsleeve" aria-pressed="false">左そで</button></div>
					<div class="cq-compact-preview" data-compact-preview data-pos="front" aria-label="選択中のプリント位置イメージ"><div class="cq-compact-preview-media"><img class="cq-compact-preview-front" src="<?php echo esc_url(plugin_dir_url(__FILE__) . 'assets/5001-images/view/0002.jpg'); ?>" width="1000" height="1000" alt="" aria-hidden="true"><img class="cq-compact-preview-back" src="<?php echo esc_url(plugin_dir_url(__FILE__) . 'assets/5001-images/back/0002.jpg'); ?>" width="1000" height="1000" alt="" aria-hidden="true"><span class="cq-compact-preview-frame" aria-hidden="true"></span></div><div class="cq-compact-preview-copy"><strong data-compact-preview-label aria-live="polite">表面：襟元（首リブ下）から約5cm下が上辺の目安</strong><p>ブラックの参考画像です。選択中の本体色とは連動しません。点線は配置イメージで、実際の位置・範囲はサイズと加工条件の確認後にご案内します。</p></div></div>
					<div class="cq-compact-colors" role="group" aria-label="プリントの色数"><span>プリント色数</span><?php foreach (range(1, 5) as $count) : ?><button type="button" data-compact-colors="<?php echo esc_attr($count); ?>" aria-pressed="<?php echo 1 === $count ? 'true' : 'false'; ?>"><?php echo esc_html($count); ?>色</button><?php endforeach; ?></div></div>
			</div>
			<div class="cq-compact-result" aria-live="polite"><p>概算合計（税込・送料込み）</p><strong data-compact-total hidden>—</strong><span data-compact-per hidden>1枚あたり —</span><p data-compact-note>希望枚数を入力してください。</p><a href="<?php echo esc_url($estimate_url); ?>" data-compact-link aria-disabled="true">この内容で詳しく見積・問い合わせ →</a><small>無地Tシャツ・1か所の版代とプリント代込み。袋詰め・完全データ入稿割引なし。送料は「九州・四国・中国・関西・中部」の設定です。ほかの地域や複数か所・DTG・DTFは詳細見積で変更できます。</small></div>
		</div>
		<div class="cq-compact-engine" hidden aria-hidden="true"><?php echo $engine; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Static plugin markup. ?></div>
	</section>
	<?php return ob_get_clean();
}
add_shortcode('cropri_compact_estimator', 'cropri_compact_estimator_shortcode');

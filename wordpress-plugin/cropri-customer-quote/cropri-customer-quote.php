<?php
/**
 * Plugin Name: CROPRI Customer Quote
 * Description: 本番の見積もり画面に向けた仮の見積ページ。ログイン中の管理者にだけ表示し、原価・利益・お客様情報は持たない。
 * Version: 1.2.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 */

if (! defined('ABSPATH')) {
	exit;
}

/**
 * 仮の見積明細(freee見積書と同じ形・税別)。G:\マイドライブ\cropri\見積_明細ルール.md の決まりで
 * cropri_quote.py が出した値。合計はラブラボ水準。
 * お客様の名前・案件名・連絡先などの個人情報は書かない。原価・利益も書かない。
 * 各行: 品目, 数量, 単位, 単価(税別)
 */
function cropri_customer_quote_lines() {
	return array(
		array('Tシャツ 5001 ホワイト S-XL', 25, '枚', 750),
		array('Tシャツ 5001 カラー S-XL', 25, '枚', 810),
		array('版代 前面(通常サイズ・1色)', 1, '版', 6000),
		array('版代 背面(特大サイズ・1色)', 1, '版', 8000),
		array('シルクプリント 前面(通常サイズ・1色)', 50, '枚', 312),
		array('シルクプリント 背面(特大サイズ・1色)', 50, '枚', 312),
		array('たたみ・袋詰め', 50, '枚', 50),
		array('送料(税込3万円以上 無料)', 1, '式', 0),
		array('デザインデータ作成(修正2回まで)', 1, '式', 0),
	);
}

function cropri_customer_quote_can_view() {
	return is_user_logged_in() && current_user_can('manage_options');
}

function cropri_customer_quote_shortcode() {
	// 誰でも見られる状態にしない。ログイン中の管理者以外には何も出力しない。
	if (! cropri_customer_quote_can_view()) {
		return '';
	}

	$lines    = cropri_customer_quote_lines();
	$subtotal = 0;
	foreach ($lines as $line) {
		$subtotal += (int) round($line[1] * $line[3]);
	}
	$tax = (int) floor($subtotal * 0.1);

	ob_start();
	?>
	<section class="cropri-customer-quote" aria-label="Tシャツ制作お見積り">
		<p class="cropri-customer-quote__eyebrow">ESTIMATE / 税別・仮</p>
		<h2>Tシャツ制作 お見積り</h2>
		<p class="cropri-customer-quote__summary">ホワイト25枚・カラー25枚／計50枚(S〜XL)。前面は通常サイズ、背面は特大サイズの各1色刷り。freeeの見積書と同じ明細(税別)です。</p>
		<table>
			<thead><tr><th scope="col">品目</th><th scope="col">数量</th><th scope="col">単価</th><th scope="col">金額</th></tr></thead>
			<tbody>
				<?php foreach ($lines as $line) : ?>
					<tr><td><?php echo esc_html($line[0]); ?></td><td><?php echo esc_html(number_format_i18n($line[1]) . $line[2]); ?></td><td><?php echo esc_html('¥' . number_format_i18n($line[3])); ?></td><td><?php echo esc_html('¥' . number_format_i18n((int) round($line[1] * $line[3]))); ?></td></tr>
				<?php endforeach; ?>
			</tbody>
			<tfoot>
				<tr class="cropri-customer-quote__tax"><th scope="row" colspan="3">小計(税別)</th><td><?php echo esc_html('¥' . number_format_i18n($subtotal)); ?></td></tr>
				<tr class="cropri-customer-quote__tax"><th scope="row" colspan="3">消費税(10%)</th><td><?php echo esc_html('¥' . number_format_i18n($tax)); ?></td></tr>
				<tr><th scope="row" colspan="3">合計(税込)</th><td><?php echo esc_html('¥' . number_format_i18n($subtotal + $tax)); ?></td></tr>
			</tfoot>
		</table>
		<p class="cropri-customer-quote__note">管理者のみに表示される仮の見積です。仕様・数量の変更時は内容に合わせて更新します。</p>
	</section>
	<?php
	return ob_get_clean();
}
add_shortcode('cropri_customer_quote', 'cropri_customer_quote_shortcode');

function cropri_customer_quote_styles() {
	if (! cropri_customer_quote_can_view()) {
		return;
	}
	$css = '.cropri-customer-quote{max-width:760px;margin:2rem auto;padding:clamp(1.25rem,4vw,2.5rem);background:#F5F3EE;border:1px solid #d9d1c2;color:#111111;font-family:"Noto Sans JP",system-ui,sans-serif}.cropri-customer-quote__eyebrow{margin:0 0 .4rem;color:#F04B2A;font-size:.75rem;font-weight:800;letter-spacing:.12em}.cropri-customer-quote h2{margin:.2rem 0 1rem;font-size:clamp(1.6rem,4vw,2.2rem)}.cropri-customer-quote__summary,.cropri-customer-quote__note{line-height:1.7;color:#706a61}.cropri-customer-quote table{width:100%;border-collapse:collapse;margin:1.5rem 0}.cropri-customer-quote th,.cropri-customer-quote td{padding:.8rem .35rem;border-bottom:1px solid #d9d1c2;text-align:left}.cropri-customer-quote td:not(:first-child),.cropri-customer-quote thead th:not(:first-child),.cropri-customer-quote tfoot td{text-align:right;white-space:nowrap}.cropri-customer-quote thead th{font-size:.78rem;color:#706a61}.cropri-customer-quote tfoot th,.cropri-customer-quote tfoot td{border-bottom:0;font-size:1.12rem}.cropri-customer-quote tfoot th{text-align:right}.cropri-customer-quote tfoot .cropri-customer-quote__tax th,.cropri-customer-quote tfoot .cropri-customer-quote__tax td{border-top:0;padding:.2rem .35rem;font-size:.86rem;color:#706a61}.cropri-customer-quote tfoot tr:first-child th,.cropri-customer-quote tfoot tr:first-child td{border-top:3px solid #111111;padding-top:1rem}.cropri-customer-quote__note{font-size:.86rem}';
	wp_register_style('cropri-customer-quote', false, array(), '1.2.0');
	wp_enqueue_style('cropri-customer-quote');
	wp_add_inline_style('cropri-customer-quote', $css);
}
add_action('wp_enqueue_scripts', 'cropri_customer_quote_styles');

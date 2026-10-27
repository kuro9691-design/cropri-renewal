<?php
/**
 * Plugin Name: CROPRI Product Gallery
 * Description: 商品詳細ページ用の軽量ギャラリー。メディアIDを指定するショートコードで、サムネイル切替とアクセシブルなLightboxを表示します。
 * Version: 0.2.3
 * Requires at least: 6.0
 * Requires PHP: 7.4
 */

if (! defined('ABSPATH')) {
	exit;
}

define('CROPRI_PRODUCT_GALLERY_VERSION', '0.2.3');

/**
 * 表示例: [cropri_product_gallery ids="101,102,103" labels="ブラック 正面,ブラック 背面,着用イメージ"]
 *
 * ids はWordPressメディアライブラリの添付ID。外部URLではなく、CROPRIへ登録済みの販促素材を使う。
 */
function cropri_product_gallery_shortcode($atts) {
	$atts = shortcode_atts(array(
		'ids'       => '',
		'images'    => '', // ids の別名。Elementorで覚えやすい方を使えるようにする。
		'labels'    => '',
		'class'     => '',
		'image_size' => 'large',
		'target'    => '', // 既存のElementor画像を操作する場合のCSSセレクタ。
	), $atts, 'cropri_product_gallery');

	$raw_ids = '' !== $atts['ids'] ? $atts['ids'] : $atts['images'];
	$ids     = array_values(array_filter(array_map('absint', preg_split('/\s*,\s*/', (string) $raw_ids))));
	if (empty($ids)) {
		return '';
	}

	$labels = array_map('sanitize_text_field', preg_split('/\s*,\s*/', (string) $atts['labels']));
	$images = array();
	foreach ($ids as $index => $attachment_id) {
		$full = wp_get_attachment_image_url($attachment_id, 'full');
		$view = wp_get_attachment_image_url($attachment_id, $atts['image_size']);
		$thumb = wp_get_attachment_image_url($attachment_id, 'thumbnail');
		if (! $full || ! $view || ! $thumb) {
			continue;
		}

		$alt = get_post_meta($attachment_id, '_wp_attachment_image_alt', true);
		$label = isset($labels[$index]) && '' !== $labels[$index] ? $labels[$index] : $alt;
		$images[] = array(
			'full'  => $full,
			'view'  => $view,
			'thumb' => $thumb,
			'alt'   => '' !== $alt ? $alt : $label,
			'label' => '' !== $label ? $label : sprintf('商品画像 %d', $index + 1),
		);
	}

	if (empty($images)) {
		return '';
	}

	cropri_product_gallery_enqueue_assets();
	$instance = wp_unique_id('cropri-product-gallery-');
	$classes = 'cropri-product-gallery';
	if ('' !== $atts['class']) {
		$classes .= ' ' . sanitize_html_class($atts['class']);
	}

	ob_start();
	?>
	<section id="<?php echo esc_attr($instance); ?>" class="<?php echo esc_attr($classes); ?>"<?php echo '' !== $atts['target'] ? ' data-target="' . esc_attr($atts['target']) . '"' : ''; ?> aria-label="商品画像ギャラリー">
		<?php if ('' === $atts['target']) : ?>
			<div class="cropri-product-gallery__stage">
				<button class="cropri-product-gallery__main" type="button" aria-label="商品画像を拡大表示">
					<img src="<?php echo esc_url($images[0]['view']); ?>" data-full="<?php echo esc_url($images[0]['full']); ?>" alt="<?php echo esc_attr($images[0]['alt']); ?>" />
				</button>
			</div>
		<?php endif; ?>
		<div class="cropri-product-gallery__thumbs" aria-label="商品写真を選ぶ">
			<?php foreach ($images as $index => $image) : ?>
				<button class="cropri-product-gallery__thumb<?php echo 0 === $index ? ' is-active' : ''; ?>" type="button" data-view="<?php echo esc_url($image['view']); ?>" data-full="<?php echo esc_url($image['full']); ?>" data-alt="<?php echo esc_attr($image['alt']); ?>" aria-pressed="<?php echo 0 === $index ? 'true' : 'false'; ?>" aria-label="<?php echo esc_attr($image['label']); ?>を表示">
					<img src="<?php echo esc_url($image['thumb']); ?>" alt="" loading="lazy" />
				</button>
			<?php endforeach; ?>
		</div>
		<button class="cropri-product-gallery__zoom" type="button">画像を拡大して見る <span aria-hidden="true">↗</span></button>
	</section>
	<?php
	return ob_get_clean();
}
add_shortcode('cropri_product_gallery', 'cropri_product_gallery_shortcode');

function cropri_product_gallery_enqueue_assets() {
	$base = plugin_dir_url(__FILE__);
	wp_enqueue_style('cropri-product-gallery', $base . 'assets/product-gallery.css', array(), CROPRI_PRODUCT_GALLERY_VERSION);
	wp_enqueue_script('cropri-product-gallery', $base . 'assets/product-gallery.js', array(), CROPRI_PRODUCT_GALLERY_VERSION, true);
}

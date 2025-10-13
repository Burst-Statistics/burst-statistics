<?php
/**
 * This class ensures there is no conflict during activation of premium when free is active
 */
if ( ! class_exists( 'BURST' ) ) {
    //phpcs:ignore
	class BURST {

		public static $instance;
		/**
		 * Instance
		 */
		public static function instance(): BURST {
			if ( ! isset( self::$instance ) && ! ( self::$instance instanceof BURST ) ) {
				self::$instance = new BURST();

			}

			return self::$instance;
		}
	}
}

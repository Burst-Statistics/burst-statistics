=== Burst Statistics - Privacy-Friendly Analytics for WordPress ===
Contributors: hesseldejong, RogierLankhorst
Donate link: paypal.me/Burststatistics
Tags: statistics, analytics, stats, analytics alternative
Requires at least: 6.4
License: GPL2
Requires PHP: 8.0
Tested up to: 6.9
Stable tag: 3.1.6

Self-hosted, privacy-friendly stats for WordPress. Simple interface, no setup. Get detailed analytics with Burst Statistics.

== Description ==
= Unlock the Power of Privacy-Friendly Analytics with Burst Statistics! =
Self-hosted, privacy-friendly WordPress stats with Burst Statistics! Our dashboards offer clear and concise insights, allowing you to make informed decisions without feeling overwhelmed by abundant data. Choose Burst Statistics for seamless and reliable analytics trusted by over 300,000 users.

**This plugin is free and does not require an account.**

= Key Features for Powerful Insights =
* **Privacy-Friendly:** All data is stored on your own server.
* **Essential Metrics:** Get the core data you need, like Pageviews, Visitors, Sessions, Time on Page, and Referrers.
* **Real-Time Data:** Get instant insights directly on your dashboard.
* **Track Your Goals:** Easily track your custom goals and keep track of conversions.
* **Free Support:** Feel free to reach out to us for assistance. We would be happy to help in any way we can.
* **Simplicity:** User-friendly analytics that does not overwhelm you with data.
* **Email Reporting:** Receive regular email reports on your website’s stats.

= Here’s a review from one of our users: =
>“On-premise Analytics is a great, if not the best, alternative to Google Analytics in the GDPR era. On top of that, since it’s native to WordPress, it’s so easy to configure Goals, etc. That’s awesome.”
>- [Daan from Daan.dev (@daanvandenbergh)](https://wordpress.org/support/topic/great-product-with-great-potential/)

= From the creators of UpdraftPlus, WP Optimize and All In One Security =
Burst Statistics was created by experienced developers who also created:
* [UpdraftPlus: WP Backup & Migration Plugin](https://wordpress.org/plugins/updraftplus/)
* [All-In-One Security (AIOS) – Security and Firewall](https://wordpress.org/plugins/all-in-one-wp-security-and-firewall/)
* [WP-Optimize – Cache, Compress images, Minify & Clean database to boost page speed & performance](https://wordpress.org/plugins/wp-optimize/)
With a proven track record of providing top-notch, user-friendly solutions, you can trust that Burst Statistics meets the same high standards.

Our community speaks for itself: with over 3,000,000 downloads and 300,000 active users, Burst Statistics is a trusted choice for your analytics needs.

= Make Burst Statistics better! =
Our team is always working on improving our plugin, and your input as a user can significantly help us in this process. You don’t require any coding or software development knowledge to contribute; simply sharing your ideas or any issues you encounter would help to improve the plugin significantly. Please feel free to contact us via [a support request on the WordPress forums; we welcome any feedback you may have.](https://wordpress.org/support/plugin/burst-statistics/)

= Get even more insight with Burst Pro =
Unlock comprehensive insights into your website’s user behavior with Burst Pro. Benefit from advanced features designed to improve performance, boost engagement, and drive conversions. [Elevate your data analysis experience by upgrading to Burst Pro today.](https://burst-statistics.com/pricing/)

Burst Pro Features include:

* **Geo-Tracking:** Identify the countries your visitors are coming from.
* **Data Archiving:** Automatic archiving and manual restore options.
* **Multiple Goals:** Track multiple objectives to measure your site’s success.
* **More metrics:** Get more insights into your website’s performance.
* **Premium Support:** Premium Support from our fantastic team.
* **URL Parameter Tracking:** Monitor the effectiveness of your URL parameters.
* **UTM Campaign Tracking:** Track the performance of your marketing campaigns.

For upcoming features, please [visit our roadmap on our website.](https://burst-statistics.com/development-roadmap/)

= Installation =
* Go to “Plugins” in your WordPress Dashboard, and click “Add new”.
* Click “Upload”, and select the downloaded .zip file.
* Activate your new plugin.
* Use our tour to get familiar with Burst Statistics.

== Frequently Asked Questions ==
= Knowledgebase =
We will maintain and grow a [knowledgebase about Burst Statistics](https://burst-statistics.com/docs/) and analytics & privacy in general.

= Where is the data stored? =
The data is stored in your own WordPress database. Unlike cloud solutions, we have no access to your data. We aim to keep the data as small as possible, and Burst can also automatically archive or delete old data. Read more about [if you need data archiving](https://burst-statistics.com/do-i-need-to-archive-my-data/).

= Do I need an account? =
No, you don’t need an account; no data is sent to another website.

= Is there a limit to the number of visitors I can track? =
No, there is no limit. The only limiting factor is your own database and server.

= Can I exclude IP addresses or user roles from tracking? =
Burst Statistics allows you to exclude specific IP addresses and user roles from tracking in the settings. Burst also excludes most known crawlers and bots from being tracked. Read more about [IP blocking](https://burst-statistics.com/exclude-ip-addresses-from-burst-statistics/) or [excluding user roles](https://burst-statistics.com/excluding-logged-in-users-by-user-role/).

= Does Burst Statistics use cookies? =
There is an option to use cookieless tracking if you prefer. But by default, Burst uses cookies because they are more accurate and lightweight. While using cookies, Burst remains privacy-friendly because all data is anonymous and stored on your server. Read more about [why cookies are misunderstood](https://burst-statistics.com/why-is-burst-privacy-friendly/#misunderstood-cookies).

= Why is Burst Statistics Privacy-Friendly? =
Burst Statistics provides an Analytics Dashboard with anonymized data that is yours and yours alone. Read more about [Why Burst Statistics is Privacy-Friendly](https://burst-statistics.com/why-is-burst-privacy-friendly/).

= What is Cookieless tracking? =
Burst Statistics can be used without setting cookies or storing data in browsers. However, this can affect accuracy, so a hybrid option with cookies after consent is possible. Read more about [Cookieless tracking](https://burst-statistics.com/definition/what-is-cookieless-tracking/).

= Does Burst Statistics affect performance? =
Performance is almost not affected. We have built Burst to be very performant for your users because we know how important it is for your website. Read more about [Turbo Mode](https://burst-statistics.com/definition/turbo-mode/)

= Is it possible to install Burst Statistics with composer? =
Absolutely! Both free and premium plugin can be managed with composer. Read the [documentation](https://burst-statistics.com/installing-burst-statistics-with-composer/) for more information.

= Can I give feedback about the plugin? =
We value your feedback. You can [submit a support request on the WordPress forums](https://wordpress.org/support/plugin/burst-statistics/), and we will respond promptly.

== Change log ==
= 3.1.6 =
* January 20th 2026
* Fix: deleting old data in archive functionality not working due to incorrect SQL syntax.
* Fix: Not filtering browser/OS data by device on the insights block, props @alisontaylorbc.
* Improvement: add automated test for data deletion.
* Improvement: add persistent sorting to datatable block, props @ankush.
* Improvement: filtering by continent.

= 3.1.5 =
* January 7th 2026
* Improvement: auto close notices in the right bottom of the screen.
* Improvement: some minor mobile responsiveness improvements.
* Improvement: extend automated tests with live visitors test.
* Improvement: wrapping of long URLs in live visitors view.
* Improvement: extended PHPCS coverage.
* Fix: when the browser's local storage is full, adding filters could cause an error.
* Fix: enforce https on combined variables and scripts URL, to prevent mixed content warnings.
* Fix: onboarding for RTL languages tried to load non existing RTL CSS file.

= 3.1.4 =
* December 23rd 2025
* Improvement: styling of datatable blocks and loading states.
* Improvement: referrer query performance improvements.
* Improvement: parameter query performance improvements.
* Improvement: exclude track hit over Rest Api from the Burst Rest Api Optimizer, this way all plugins are loaded during the hit, which is required for hook goals.
* Improvement: added fallback to default method for combine variables and scripts, in case the uploads directory is not writable.
* Improvement: the 'cron not running' notice not dismissible anymore, as it is a critical issue.
* Improvement: allow search for formatted data on datatables, e.g. you can now search for 'United States' instead of US on the locations datatable.
* Improvement: add parameter filtering.
* Fix: filtering on devices block.

= 3.1.0.3 =
* December 1st
* Fix: saving settings changes after saving initial changes required a reload.
* Performance: Performance improvements by offloading resource greedy processes during tracking to cron in batches
* Improvement: User Agent Parser improvements, removing invalid browsers
* Fix: dropdown for advanced filters not filtering the list.
* Fix: undefined tab caused by incomplete removal of sales menu when no WooCommerce or EDD detected.
* Fix: object caching on page counts causing slow update of page counts, props @fveits

= 3.0.2 =
* November 25th 2025
* Fix: some notices were incorrectly dismissed during validation.
* Improvement: added automated test for hook goals.
* Improvement: added automated test for archiving restoration.

= 3.0.0 =
* November 11th 2025
* Fix: compability with unknown plugin, allowing null value in get_timerange_dropdown() on WooCommerce products overview, props @tegid
* Fix: do not treat www and non www domains as different domains, when detecting multiple domains setup.
* Fix: remove obsolete slash in loading of goals script, which on some setups causes it to get blocked, props @jhndkrvzc
* Fix: top bar count did not show the 'k' for thousands, 'M' for millions, etc, only showing 1, instead of 1k.
* New: increase minimal required versions for PHP to 8.0, for WordPress to 6.4

= 2.2.9.3 =
* Fix: some css styling fixed.

= 2.2.9.2 =
* Improvement: css change to ensure Burst icon aligned correctly in menu
* Improvement: remove obsolete log line
* Improvement: remove upgrader_process_complete hook to handle upgrades
* Improvement: removed some obsolete files

= 2.2.9.1 =
* Improvement: Date range selection option in pages and posts overview screen options.
* Fix: issue in onboarding wizard data storing.

= 2.2.9 =
* Fix: move the code directory from /src to /includes, because otherwise javascript files are not scanned for translations by WordPress

= 2.2.8 =
* New: improved library for cookieless tracking.
* New: entry/exit pages filter
* Improvement: added fallback database upgrade mechanism in case the normal upgrade didn't fire.
* Improvement: dismissal of PHP notice.

= 2.2.7 =
* New: Detailed live visitors tab
* Improvement: responsiveness on mobile, restored 1280px breakpoint
* Improvement: suspicious data (over 1000 visits from 1 user) is now only detected and the admin notified, not automatically removed.
* Fix: on multisite with Burst network activated, the endpoint incorrectly did not detect Burst as active, which prevents tracking from occuring.

= 2.2.6.1 =
* Fix: remove false positive notice about missing tables.

= 2.2.6 =
* Improvement: pass post_id to javascript using a data attribute in the body element, to improve accuracy of the page specific pageviews.
* Improvement: dropped usage of the imprecise post_meta pageviews metric entirely.
* Improvement: made it possible to track hook goals with cookieless tracking.
* Improvement: migrated all remaining css to tailwind css.
* Fix: Group by on parameters overview should group by combination of parameter and value.

== Upgrade notice ==
* Please backup before upgrading.

== Screenshots ==
1. Burst Statistics: Analytics Dashboard
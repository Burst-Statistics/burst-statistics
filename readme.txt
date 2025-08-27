=== Burst Statistics - Privacy-Friendly Analytics for WordPress ===
Contributors: hesseldejong, RogierLankhorst, aahulsebos, leonwimmenhoeve
Donate link: paypal.me/Burststatistics
Tags: statistics, analytics, stats, analytics alternative
Requires at least: 6.2
License: GPL2
Requires PHP: 7.4
Tested up to: 6.8
Stable tag: 2.2.4

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
= 2.2.4 =
* New: debug information in Site Health Info.
* New: wildcard filtering on page URL in advanced filters, by adding an asterisk behind your string.
* Improvement: check in endpoint if Burst is still active, for situations where javascript is still active, due to caching, but plugin not active.
* Improvement: catch incorrect data structure on hit, for situations where previous javascript is still active due to caching.
* Improvement: larger selection of Tips & Tricks retrieved from website, showing a variety of different and more up to date articles.
* Improvement: performance optimizations.
* Fix: when statistics table is empty, the summary table upgrade could fail on an empty value for "first visit", props @programmin.
* Fix: catch edge case where a theme passes a null value to the "the_content" filter (which is incorrect behaviour). props @sllew.
* Fix: incorrect bounce calculation, resulting in too high bounces and bounce rates.

= 2.2.3 =
* Improvement: allow ipv6 addresses
* Improvement: prevent false positives on ajax fallback notice
* Improvement: rest optimizer improvements

= 2.2.2 =
* New: Extensive range of filter options to easily track what campaigns are delivering your conversions!
* Improvement: Added CORS support to tracking endpoint to allow cross-origin requests via fetch/sendBeacon. props Alex
* Improvement: automatic cleanup of anomalous numbers of visits, when one visitor results in over 1000 page views in 24 hours (customizable with filters).
* Improvement: remove duplicate non necessary json_encode from endpoint
* Improvement: Add logging option to check error responses on the endpoint or rest api, when BURST_DEBUG and WP_DEBUG are set to true.
* Fix: when the weekly statistics report was sent on another day than the default day, date range calculation could retrieve the wrong range. props Pieter
* Fix: Referrer filter not working. props @lekkerbezig
* Fix: allow for alternative WordPress location, e.g. in subfolder 'wp'.

= 2.2.1 =
* Fix: usage of wrong key prevented upgrade from completing

= 2.2.0 =
* New: extended range of shortcodes.
* New: goal element preview to check if the selected element exists on the page.
* Improvement: moved all hooks from constructor to init method.
* Improvement: remove bounce=0 conditions on goal filtering
* Fix: Integrations not loading due to path change in 2.0.
* Fix: First time visits counting duplicates for visitors on cookieless tracking when they came back after a month.
* Fix: multisite redirect to network, but should redirect to main site, props @muttleydosomething

= 2.1.0 =
* Fix: type mismatch when browser key is not in the user agent data.
* New: Onboarding wizard for new users.

= 2.0.9 =
* Fix: incorrect "best device" conversion rate on the goals block.
* Fix: when running tasks validation, summary warning call caused an error, due to wrong call.
* Improvement: allow null value in admin_enqueue_scripts to prevent Visual Composer causing fatal error.
* Improvement: changed plugin_url value to use site_url instead of get_plugin_url() to prevent mixed content.

= 2.0.8 =
* Fix: filtering by referrer not working.
* Fix: Dashboard submenu link only working when the Burst settings page was already loaded.

= 2.0.7 =
* Fix: in some cases a php warning could be shown on the endpoint.
* Improvement: drop option for administrators to send an email report by adding a query variable.
* Improvement: improved efficiency of burst_find_wordpress_base_path() function.

= 2.0.6 =
* Improvement: optimized database upgrade.
* New: rewritten plugin for even better performance
* New: extended range of automated tests to increase reliability

= 1.8.0.1 =
* Fix: Goals block details not showing correct data.
* Fix: Click goals not always tracking correctly.

= 1.8.0 =
* Improvement: add a fallback to allow for servers with a very small bytes limit on indexes.
* Improvement: restructured the way tasks are stored.
* Improvement: dropped load_plugin_textdomain, as it is not necessary anymore.
* Improvement: the way the visits count on the pages and posts overview is tracked is changed, to better stay in sync with the page visits within Burst itself.
* Fix: A dismissible task like the new email reports upgrade notice stayed in the “remaining tasks” section.
* Fix: predefined goals were not loading due to changes in translation structure within WordPress.
* Fix: on track_updates, empty values were not cleaned up correctly, possibly leading to rows with empty devices and browsers.

== Upgrade notice ==
* Please backup before upgrading.

== Screenshots ==
1. Burst Statistics: Analytics Dashboard
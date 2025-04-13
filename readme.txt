=== Burst Statistics - Privacy-Friendly Analytics for WordPress ===
Contributors: hesseldejong, RogierLankhorst, aahulsebos, leonwimmenhoeve
Donate link: paypal.me/Burststatistics
Tags: statistics, analytics, stats, analytics alternative
Requires at least: 6.0
License: GPL2
Requires PHP: 7.2
Tested up to: 6.8
Stable tag: 1.8.0.1

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

= Can I give feedback about the plugin? =
We value your feedback. You can [submit a support request on the WordPress forums](https://wordpress.org/support/plugin/burst-statistics/), and we will respond promptly.

== Change log ==
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

= 1.7.6 =
* Fix: translations not loading correctly
* Fix: when using the reset button, a fatal error occurred

= 1.7.5 =
* Fix: Resolved an issue where plain permalinks were not working correctly.
* Fix: Goals were not saving the start date properly, this has been corrected.
* Fix: Fixed the goals ID/class toggle issue for better consistency.
* Improvement: Added a new filter for customizing datatable output.
* Improvement: Enhanced `get_website_url()` for improved reliability.
* Security: Applied `unslash()` to `verify_nonce` to enhance security measures.

= 1.7.4 =
* Improvement: Limit live update requests to enhance system performance.
* Improvement: Added an option to exclude bounces, allowing users to adjust settings more easily.
* Fix: This addresses the issue with sorting by 0 in WordPress.
* Fix: Prevent duplication of burst post meta when Yoast Duplicate Post is used. props @dariuserdt
* Fix: Corrects the behavior of the burst_admin_url() function when it receives a path, ensuring it is properly handled.
* Fix: Prevent burst tracking from causing server spikes when Complianz clears cookies without consent for stats.

= 1.7.3 =
* November 18, 2024
* New: Blueprint.js demo data
* Improvement: option to override the default time between endpoint tests, props @tobaco
* Improvement: allow parameter length over 250 characters, props @ficusmedia
* Improvement: option to dismiss all notices, except critical issues, props @3cstudio
* Fix: clear unused 5 minutes cron job
* Fix: on deactivation on multisite, not all tables were deleted yet, props @ecce-homo
* Improvement: Change column parameters to text to allow longer params.
* Improvement: Added a composite index on uid and time to speed up inserting tracking data. props @johannesdb
* Fix: Language issue with malformed URL's. props @apollosk
* Fix: Issue with translatable files with WP 6.7.

== Upgrade notice ==
* Please backup before upgrading.

== Screenshots ==
1. Burst Statistics: Analytics Dashboard
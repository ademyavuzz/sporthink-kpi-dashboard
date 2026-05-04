-- Sporthink KPI Dashboard — schema baseline
-- mysqldump'tan üretildi (no-data + seed: permissions, roles, channel_mapping)
-- Süper Admin user seed.py tarafından env-based oluşturulur (baseline'da yok).


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned DEFAULT NULL,
  `user_email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `resource_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `resource_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `details` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`,`created_at`),
  KEY `idx_user` (`user_id`),
  KEY `idx_action` (`action`),
  KEY `idx_resource` (`resource_type`,`resource_id`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=102 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
/*!50100 PARTITION BY RANGE (to_days(`created_at`))
(PARTITION p202605 VALUES LESS THAN (740133) ENGINE = InnoDB,
 PARTITION p202606 VALUES LESS THAN (740163) ENGINE = InnoDB,
 PARTITION p202607 VALUES LESS THAN (740194) ENGINE = InnoDB,
 PARTITION p202608 VALUES LESS THAN (740225) ENGINE = InnoDB,
 PARTITION p202609 VALUES LESS THAN (740255) ENGINE = InnoDB,
 PARTITION p202610 VALUES LESS THAN (740286) ENGINE = InnoDB,
 PARTITION p202611 VALUES LESS THAN (740316) ENGINE = InnoDB,
 PARTITION p202612 VALUES LESS THAN (740347) ENGINE = InnoDB,
 PARTITION p202701 VALUES LESS THAN (740378) ENGINE = InnoDB,
 PARTITION p202702 VALUES LESS THAN (740406) ENGINE = InnoDB,
 PARTITION p202703 VALUES LESS THAN (740437) ENGINE = InnoDB,
 PARTITION p202704 VALUES LESS THAN (740467) ENGINE = InnoDB,
 PARTITION p202705 VALUES LESS THAN (740498) ENGINE = InnoDB,
 PARTITION p202706 VALUES LESS THAN (740528) ENGINE = InnoDB,
 PARTITION p202707 VALUES LESS THAN (740559) ENGINE = InnoDB,
 PARTITION p202708 VALUES LESS THAN (740590) ENGINE = InnoDB,
 PARTITION p202709 VALUES LESS THAN (740620) ENGINE = InnoDB,
 PARTITION p202710 VALUES LESS THAN (740651) ENGINE = InnoDB,
 PARTITION p202711 VALUES LESS THAN (740681) ENGINE = InnoDB,
 PARTITION p202712 VALUES LESS THAN (740712) ENGINE = InnoDB,
 PARTITION p202801 VALUES LESS THAN (740743) ENGINE = InnoDB,
 PARTITION p202802 VALUES LESS THAN (740772) ENGINE = InnoDB,
 PARTITION p202803 VALUES LESS THAN (740803) ENGINE = InnoDB,
 PARTITION p202804 VALUES LESS THAN (740833) ENGINE = InnoDB,
 PARTITION p202805 VALUES LESS THAN (740864) ENGINE = InnoDB,
 PARTITION p202806 VALUES LESS THAN (740894) ENGINE = InnoDB,
 PARTITION p202807 VALUES LESS THAN (740925) ENGINE = InnoDB,
 PARTITION p202808 VALUES LESS THAN (740956) ENGINE = InnoDB,
 PARTITION p202809 VALUES LESS THAN (740986) ENGINE = InnoDB,
 PARTITION p202810 VALUES LESS THAN (741017) ENGINE = InnoDB,
 PARTITION p202811 VALUES LESS THAN (741047) ENGINE = InnoDB,
 PARTITION p202812 VALUES LESS THAN (741078) ENGINE = InnoDB,
 PARTITION p202901 VALUES LESS THAN (741109) ENGINE = InnoDB,
 PARTITION p202902 VALUES LESS THAN (741137) ENGINE = InnoDB,
 PARTITION p202903 VALUES LESS THAN (741168) ENGINE = InnoDB,
 PARTITION p202904 VALUES LESS THAN (741198) ENGINE = InnoDB,
 PARTITION pmax VALUES LESS THAN MAXVALUE ENGINE = InnoDB) */;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `campaigns` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `platform` enum('meta','google') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `external_campaign_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `campaign_name` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `campaign_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `objective` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `daily_budget` decimal(15,2) DEFAULT NULL,
  `total_budget` decimal(15,2) DEFAULT NULL,
  `target_audience` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('active','paused','completed') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_platform_external` (`platform`,`external_campaign_id`),
  KEY `idx_platform` (`platform`),
  KEY `idx_dates` (`start_date`,`end_date`),
  KEY `idx_status` (`status`),
  KEY `idx_campaign_name` (`campaign_name`(100)),
  KEY `idx_deleted` (`deleted_at`),
  KEY `fk_campaigns_created_by` (`created_by`),
  KEY `fk_campaigns_updated_by` (`updated_by`),
  CONSTRAINT `fk_campaigns_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_campaigns_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `channel_mapping` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `source` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `medium` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `channel_group` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_auto_assigned` tinyint(1) NOT NULL DEFAULT '0',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_source_medium` (`source`,`medium`),
  KEY `idx_deleted` (`deleted_at`),
  KEY `fk_cm_created_by` (`created_by`),
  KEY `fk_cm_updated_by` (`updated_by`),
  CONSTRAINT `fk_cm_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_cm_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customers` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `customer_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `first_order_date` date NOT NULL,
  `registration_date` date NOT NULL,
  `city` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gender` enum('male','female') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `age_group` enum('18-24','25-34','35-44','45-54','55-64','65+') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `registration_source` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_newsletter_subscriber` tinyint(1) NOT NULL DEFAULT '0',
  `total_orders` int unsigned NOT NULL DEFAULT '0',
  `total_revenue` decimal(15,2) NOT NULL DEFAULT '0.00',
  `last_order_date` date DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_customer_id` (`customer_id`),
  KEY `idx_first_order` (`first_order_date`),
  KEY `idx_last_order` (`last_order_date`),
  KEY `idx_city` (`city`),
  KEY `idx_gender_age` (`gender`,`age_group`),
  KEY `idx_total_orders` (`total_orders`),
  KEY `idx_total_revenue` (`total_revenue`),
  KEY `idx_deleted` (`deleted_at`),
  KEY `fk_customers_created_by` (`created_by`),
  KEY `fk_customers_updated_by` (`updated_by`),
  CONSTRAINT `fk_customers_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_customers_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10001 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ga4_item_engagement` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `import_id` bigint unsigned NOT NULL,
  `date` date NOT NULL,
  `product_pk_id` bigint unsigned DEFAULT NULL,
  `item_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_name` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `item_category` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `item_category2` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `item_brand` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `items_viewed` int unsigned NOT NULL DEFAULT '0',
  `items_added_to_cart` int unsigned NOT NULL DEFAULT '0',
  `items_checked_out` int unsigned NOT NULL DEFAULT '0',
  `items_purchased` int unsigned NOT NULL DEFAULT '0',
  `item_revenue` decimal(15,2) NOT NULL DEFAULT '0.00',
  `item_list_views` int unsigned NOT NULL DEFAULT '0',
  `item_list_clicks` int unsigned NOT NULL DEFAULT '0',
  `cart_to_view_rate` decimal(7,4) GENERATED ALWAYS AS (if((`items_viewed` > 0),(`items_added_to_cart` / `items_viewed`),0)) STORED,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_date` (`date`),
  KEY `idx_item` (`item_id`),
  KEY `idx_date_item` (`date`,`item_id`),
  KEY `idx_brand` (`item_brand`),
  KEY `idx_category` (`item_category`),
  KEY `idx_import` (`import_id`),
  KEY `idx_product_pk` (`product_pk_id`),
  CONSTRAINT `fk_ga4i_import` FOREIGN KEY (`import_id`) REFERENCES `imports` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_ga4i_product` FOREIGN KEY (`product_pk_id`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=59421 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ga4_traffic` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `import_id` bigint unsigned NOT NULL,
  `date` date NOT NULL,
  `session_source` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `session_medium` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `session_campaign_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `session_default_channel_group` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `derived_channel` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `device_category` enum('mobile','desktop','tablet','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `city` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `landing_page_plus_query_string` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_vs_returning` enum('new','returning') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sessions` int unsigned NOT NULL DEFAULT '0',
  `total_users` int unsigned NOT NULL DEFAULT '0',
  `new_users` int unsigned NOT NULL DEFAULT '0',
  `bounce_rate` decimal(7,4) NOT NULL DEFAULT '0.0000',
  `average_session_duration` decimal(10,2) NOT NULL DEFAULT '0.00',
  `screen_page_views_per_session` decimal(8,2) NOT NULL DEFAULT '0.00',
  `engaged_sessions` int unsigned NOT NULL DEFAULT '0',
  `engagement_rate` decimal(7,4) NOT NULL DEFAULT '0.0000',
  `user_engagement_duration` decimal(15,2) NOT NULL DEFAULT '0.00',
  `conversions` int unsigned NOT NULL DEFAULT '0',
  `purchase_revenue` decimal(15,2) NOT NULL DEFAULT '0.00',
  `transactions` int unsigned NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_date` (`date`),
  KEY `idx_date_channel` (`date`,`session_default_channel_group`),
  KEY `idx_date_device` (`date`,`device_category`),
  KEY `idx_date_source_medium` (`date`,`session_source`(50),`session_medium`),
  KEY `idx_import` (`import_id`),
  CONSTRAINT `fk_ga4t_import` FOREIGN KEY (`import_id`) REFERENCES `imports` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=92635 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `google_ads` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `import_id` bigint unsigned NOT NULL,
  `date` date NOT NULL,
  `customer_id` bigint DEFAULT NULL,
  `customer_descriptive_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `campaign_pk_id` bigint unsigned DEFAULT NULL,
  `campaign_id` bigint NOT NULL,
  `campaign_name` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `campaign_status` enum('enabled','paused','removed') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `advertising_channel_type` enum('search','shopping','performance_max','display','video') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ad_group_id` bigint DEFAULT NULL,
  `ad_group_name` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ad_group_status` enum('enabled','paused','removed') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `device` enum('mobile','desktop','tablet','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ad_network_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `conversion_action_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `product_item_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `product_title` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `product_brand` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `product_type_l1` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `product_type_l2` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `keyword_text` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `keyword_match_type` enum('exact','phrase','broad') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `search_term` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `impressions` bigint unsigned NOT NULL DEFAULT '0',
  `clicks` bigint unsigned NOT NULL DEFAULT '0',
  `cost` decimal(15,2) NOT NULL DEFAULT '0.00',
  `ctr` decimal(7,4) NOT NULL DEFAULT '0.0000',
  `average_cpc` decimal(10,4) NOT NULL DEFAULT '0.0000',
  `average_cpm` decimal(10,4) NOT NULL DEFAULT '0.0000',
  `conversions` decimal(10,2) NOT NULL DEFAULT '0.00',
  `conversions_value` decimal(15,2) NOT NULL DEFAULT '0.00',
  `all_conversions` decimal(10,2) NOT NULL DEFAULT '0.00',
  `all_conversions_value` decimal(15,2) NOT NULL DEFAULT '0.00',
  `cost_per_conversion` decimal(10,2) NOT NULL DEFAULT '0.00',
  `conversions_from_interactions_rate` decimal(8,4) NOT NULL DEFAULT '0.0000',
  `value_per_conversion` decimal(10,2) NOT NULL DEFAULT '0.00',
  `search_impression_share` decimal(7,4) DEFAULT NULL,
  `search_budget_lost_impression_share` decimal(7,4) DEFAULT NULL,
  `search_rank_lost_impression_share` decimal(7,4) DEFAULT NULL,
  `view_through_conversions` bigint unsigned NOT NULL DEFAULT '0',
  `interaction_rate` decimal(8,4) NOT NULL DEFAULT '0.0000',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_date` (`date`),
  KEY `idx_date_campaign` (`date`,`campaign_id`),
  KEY `idx_campaign` (`campaign_id`),
  KEY `idx_campaign_pk` (`campaign_pk_id`),
  KEY `idx_ad_group` (`ad_group_id`),
  KEY `idx_product` (`product_item_id`),
  KEY `idx_channel_type` (`advertising_channel_type`),
  KEY `idx_import` (`import_id`),
  CONSTRAINT `fk_gads_campaign` FOREIGN KEY (`campaign_pk_id`) REFERENCES `campaigns` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_gads_import` FOREIGN KEY (`import_id`) REFERENCES `imports` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=57747 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `import_errors` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `import_id` bigint unsigned NOT NULL,
  `source_row_number` int unsigned NOT NULL,
  `field_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `error_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `error_message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `row_data` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_import` (`import_id`),
  KEY `idx_error_code` (`error_code`),
  CONSTRAINT `fk_ie_import` FOREIGN KEY (`import_id`) REFERENCES `imports` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=415 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `imports` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned DEFAULT NULL,
  `file_name` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_path` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_size` bigint unsigned NOT NULL,
  `file_format` enum('csv','xlsx','json') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `data_type` enum('ga4_traffic','ga4_items','meta_ads','meta_breakdowns','google_ads','orders','order_items','products','customers','campaigns') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','parsing','validating','committing','completed','failed','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `progress_percentage` int NOT NULL DEFAULT '0',
  `total_rows` int DEFAULT NULL,
  `valid_rows` int DEFAULT NULL,
  `invalid_rows` int DEFAULT NULL,
  `skipped_rows` int DEFAULT NULL,
  `inserted_rows` int DEFAULT NULL,
  `duplicate_strategy` enum('overwrite','skip','cancel') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `error_strategy` enum('skip','abort','ask') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `column_mapping` json DEFAULT NULL,
  `error_message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `started_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `duration_seconds` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_data_type` (`data_type`),
  KEY `idx_created` (`created_at`),
  CONSTRAINT `fk_imports_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kpi_campaign_aggregates` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `campaign_pk_id` bigint unsigned NOT NULL,
  `campaign_external_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `campaign_name` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `platform` enum('meta','google') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `period_start` date NOT NULL,
  `period_end` date NOT NULL,
  `impressions` bigint unsigned DEFAULT '0',
  `clicks` bigint unsigned DEFAULT '0',
  `spend` decimal(15,2) DEFAULT '0.00',
  `conversions` decimal(10,2) DEFAULT '0.00',
  `conversions_value` decimal(15,2) DEFAULT '0.00',
  `ctr` decimal(8,4) GENERATED ALWAYS AS (if((`impressions` > 0),((`clicks` / `impressions`) * 100),0)) STORED,
  `cpc` decimal(10,4) GENERATED ALWAYS AS (if((`clicks` > 0),(`spend` / `clicks`),0)) STORED,
  `roas` decimal(10,4) GENERATED ALWAYS AS (if((`spend` > 0),(`conversions_value` / `spend`),0)) STORED,
  `last_calculated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_campaign_period` (`campaign_pk_id`,`period_start`,`period_end`),
  KEY `idx_campaign_pk` (`campaign_pk_id`),
  KEY `idx_period` (`period_start`,`period_end`),
  KEY `idx_platform` (`platform`),
  KEY `idx_roas` (`roas`),
  CONSTRAINT `fk_kca_campaign` FOREIGN KEY (`campaign_pk_id`) REFERENCES `campaigns` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kpi_daily_aggregates` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `channel` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `platform` enum('ga4','meta','google','ecommerce') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `device` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sessions` int unsigned DEFAULT '0',
  `users` int unsigned DEFAULT '0',
  `new_users` int unsigned DEFAULT '0',
  `bounce_sessions` int unsigned DEFAULT '0',
  `total_session_duration` decimal(15,2) DEFAULT '0.00',
  `total_page_views` int unsigned DEFAULT '0',
  `impressions` bigint unsigned DEFAULT '0',
  `clicks` bigint unsigned DEFAULT '0',
  `spend` decimal(15,2) DEFAULT '0.00',
  `ad_conversions` decimal(10,2) DEFAULT '0.00',
  `ad_revenue` decimal(15,2) DEFAULT '0.00',
  `orders` int unsigned DEFAULT '0',
  `revenue` decimal(15,2) DEFAULT '0.00',
  `items_sold` int unsigned DEFAULT '0',
  `discount_total` decimal(15,2) DEFAULT '0.00',
  `refund_total` decimal(15,2) DEFAULT '0.00',
  `last_calculated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`,`date`),
  UNIQUE KEY `uk_date_channel_platform_device` (`date`,`channel`,`platform`,`device`),
  KEY `idx_date` (`date`),
  KEY `idx_date_channel` (`date`,`channel`),
  KEY `idx_date_platform` (`date`,`platform`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
/*!50100 PARTITION BY RANGE (to_days(`date`))
(PARTITION p202605 VALUES LESS THAN (740133) ENGINE = InnoDB,
 PARTITION p202606 VALUES LESS THAN (740163) ENGINE = InnoDB,
 PARTITION p202607 VALUES LESS THAN (740194) ENGINE = InnoDB,
 PARTITION p202608 VALUES LESS THAN (740225) ENGINE = InnoDB,
 PARTITION p202609 VALUES LESS THAN (740255) ENGINE = InnoDB,
 PARTITION p202610 VALUES LESS THAN (740286) ENGINE = InnoDB,
 PARTITION p202611 VALUES LESS THAN (740316) ENGINE = InnoDB,
 PARTITION p202612 VALUES LESS THAN (740347) ENGINE = InnoDB,
 PARTITION p202701 VALUES LESS THAN (740378) ENGINE = InnoDB,
 PARTITION p202702 VALUES LESS THAN (740406) ENGINE = InnoDB,
 PARTITION p202703 VALUES LESS THAN (740437) ENGINE = InnoDB,
 PARTITION p202704 VALUES LESS THAN (740467) ENGINE = InnoDB,
 PARTITION p202705 VALUES LESS THAN (740498) ENGINE = InnoDB,
 PARTITION p202706 VALUES LESS THAN (740528) ENGINE = InnoDB,
 PARTITION p202707 VALUES LESS THAN (740559) ENGINE = InnoDB,
 PARTITION p202708 VALUES LESS THAN (740590) ENGINE = InnoDB,
 PARTITION p202709 VALUES LESS THAN (740620) ENGINE = InnoDB,
 PARTITION p202710 VALUES LESS THAN (740651) ENGINE = InnoDB,
 PARTITION p202711 VALUES LESS THAN (740681) ENGINE = InnoDB,
 PARTITION p202712 VALUES LESS THAN (740712) ENGINE = InnoDB,
 PARTITION p202801 VALUES LESS THAN (740743) ENGINE = InnoDB,
 PARTITION p202802 VALUES LESS THAN (740772) ENGINE = InnoDB,
 PARTITION p202803 VALUES LESS THAN (740803) ENGINE = InnoDB,
 PARTITION p202804 VALUES LESS THAN (740833) ENGINE = InnoDB,
 PARTITION p202805 VALUES LESS THAN (740864) ENGINE = InnoDB,
 PARTITION p202806 VALUES LESS THAN (740894) ENGINE = InnoDB,
 PARTITION p202807 VALUES LESS THAN (740925) ENGINE = InnoDB,
 PARTITION p202808 VALUES LESS THAN (740956) ENGINE = InnoDB,
 PARTITION p202809 VALUES LESS THAN (740986) ENGINE = InnoDB,
 PARTITION p202810 VALUES LESS THAN (741017) ENGINE = InnoDB,
 PARTITION p202811 VALUES LESS THAN (741047) ENGINE = InnoDB,
 PARTITION p202812 VALUES LESS THAN (741078) ENGINE = InnoDB,
 PARTITION p202901 VALUES LESS THAN (741109) ENGINE = InnoDB,
 PARTITION p202902 VALUES LESS THAN (741137) ENGINE = InnoDB,
 PARTITION p202903 VALUES LESS THAN (741168) ENGINE = InnoDB,
 PARTITION p202904 VALUES LESS THAN (741198) ENGINE = InnoDB,
 PARTITION pmax VALUES LESS THAN MAXVALUE ENGINE = InnoDB) */;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kpi_monthly_aggregates` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `period_month` date NOT NULL,
  `channel` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `platform` enum('ga4','meta','google','ecommerce') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `device` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sessions` int unsigned DEFAULT '0',
  `users` int unsigned DEFAULT '0',
  `new_users` int unsigned DEFAULT '0',
  `bounce_sessions` int unsigned DEFAULT '0',
  `impressions` bigint unsigned DEFAULT '0',
  `clicks` bigint unsigned DEFAULT '0',
  `spend` decimal(15,2) DEFAULT '0.00',
  `ad_conversions` decimal(10,2) DEFAULT '0.00',
  `ad_revenue` decimal(15,2) DEFAULT '0.00',
  `orders` int unsigned DEFAULT '0',
  `revenue` decimal(15,2) DEFAULT '0.00',
  `items_sold` int unsigned DEFAULT '0',
  `discount_total` decimal(15,2) DEFAULT '0.00',
  `refund_total` decimal(15,2) DEFAULT '0.00',
  `last_calculated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_month_channel_platform_device` (`period_month`,`channel`,`platform`,`device`),
  KEY `idx_period_month` (`period_month`),
  KEY `idx_period_channel` (`period_month`,`channel`),
  KEY `idx_period_platform` (`period_month`,`platform`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `meta_ads` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `import_id` bigint unsigned NOT NULL,
  `date_start` date NOT NULL,
  `date_stop` date NOT NULL,
  `account_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `account_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `campaign_pk_id` bigint unsigned DEFAULT NULL,
  `campaign_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `campaign_name` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `adset_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `adset_name` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ad_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ad_name` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `objective` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `buying_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `impressions` int unsigned NOT NULL DEFAULT '0',
  `reach` int unsigned NOT NULL DEFAULT '0',
  `frequency` decimal(8,4) NOT NULL DEFAULT '0.0000',
  `clicks` int unsigned NOT NULL DEFAULT '0',
  `inline_link_clicks` int unsigned NOT NULL DEFAULT '0',
  `spend` decimal(15,2) NOT NULL DEFAULT '0.00',
  `cpc` decimal(10,4) NOT NULL DEFAULT '0.0000',
  `cpm` decimal(10,4) NOT NULL DEFAULT '0.0000',
  `cpp` decimal(10,4) NOT NULL DEFAULT '0.0000',
  `ctr` decimal(8,4) NOT NULL DEFAULT '0.0000',
  `inline_link_click_ctr` decimal(8,4) NOT NULL DEFAULT '0.0000',
  `actions_link_click` int unsigned NOT NULL DEFAULT '0',
  `actions_landing_page_view` int unsigned NOT NULL DEFAULT '0',
  `actions_view_content` int unsigned NOT NULL DEFAULT '0',
  `actions_add_to_cart` int unsigned NOT NULL DEFAULT '0',
  `actions_initiate_checkout` int unsigned NOT NULL DEFAULT '0',
  `actions_purchase` int unsigned NOT NULL DEFAULT '0',
  `action_values_purchase` decimal(15,2) NOT NULL DEFAULT '0.00',
  `actions_page_engagement` int unsigned NOT NULL DEFAULT '0',
  `actions_post_engagement` int unsigned NOT NULL DEFAULT '0',
  `actions_video_view` int unsigned NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_date` (`date_start`),
  KEY `idx_date_campaign` (`date_start`,`campaign_id`),
  KEY `idx_campaign` (`campaign_id`),
  KEY `idx_campaign_pk` (`campaign_pk_id`),
  KEY `idx_adset` (`adset_id`),
  KEY `idx_ad` (`ad_id`),
  KEY `idx_import` (`import_id`),
  CONSTRAINT `fk_meta_campaign` FOREIGN KEY (`campaign_pk_id`) REFERENCES `campaigns` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_meta_import` FOREIGN KEY (`import_id`) REFERENCES `imports` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5989 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `meta_ads_breakdowns` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `import_id` bigint unsigned NOT NULL,
  `date_start` date NOT NULL,
  `date_stop` date DEFAULT NULL,
  `campaign_pk_id` bigint unsigned DEFAULT NULL,
  `campaign_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `adset_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `adset_name` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ad_name` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `age` enum('13-17','18-24','25-34','35-44','45-54','55-64','65+','unknown') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gender` enum('male','female','unknown') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `publisher_platform` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `platform_position` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `impression_device` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `country` varchar(2) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `region` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `impressions` int unsigned NOT NULL DEFAULT '0',
  `reach` int unsigned NOT NULL DEFAULT '0',
  `clicks` int unsigned NOT NULL DEFAULT '0',
  `spend` decimal(15,2) NOT NULL DEFAULT '0.00',
  `actions_purchase` int unsigned NOT NULL DEFAULT '0',
  `action_values_purchase` decimal(15,2) NOT NULL DEFAULT '0.00',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_date_campaign` (`date_start`,`campaign_id`),
  KEY `idx_campaign_pk` (`campaign_pk_id`),
  KEY `idx_age_gender` (`age`,`gender`),
  KEY `idx_platform` (`publisher_platform`),
  KEY `idx_import` (`import_id`),
  CONSTRAINT `fk_metab_campaign` FOREIGN KEY (`campaign_pk_id`) REFERENCES `campaigns` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_metab_import` FOREIGN KEY (`import_id`) REFERENCES `imports` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=107785 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `import_id` bigint unsigned NOT NULL,
  `order_pk_id` bigint unsigned NOT NULL,
  `order_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `line_id` int unsigned NOT NULL,
  `product_pk_id` bigint unsigned DEFAULT NULL,
  `item_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_name` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `item_category` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `item_category2` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `item_brand` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` int unsigned NOT NULL,
  `unit_price` decimal(15,2) NOT NULL,
  `line_total` decimal(15,2) NOT NULL,
  `discount_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `refund_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_line` (`order_pk_id`,`line_id`),
  KEY `idx_order_pk` (`order_pk_id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_product_pk` (`product_pk_id`),
  KEY `idx_item` (`item_id`),
  KEY `idx_brand` (`item_brand`),
  KEY `idx_category` (`item_category`),
  KEY `idx_import` (`import_id`),
  CONSTRAINT `fk_oi_import` FOREIGN KEY (`import_id`) REFERENCES `imports` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_oi_order` FOREIGN KEY (`order_pk_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_oi_product` FOREIGN KEY (`product_pk_id`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=54813 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `import_id` bigint unsigned NOT NULL,
  `order_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `order_date` datetime NOT NULL,
  `customer_pk_id` bigint unsigned NOT NULL,
  `customer_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `city` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `device` enum('mobile','desktop','tablet') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `channel` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `source` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `medium` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `campaign_name` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `coupon_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `product_count` int unsigned NOT NULL DEFAULT '0',
  `order_revenue` decimal(15,2) NOT NULL,
  `shipping_cost` decimal(10,2) NOT NULL DEFAULT '0.00',
  `discount_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `refund_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `net_revenue` decimal(15,2) GENERATED ALWAYS AS (((`order_revenue` - `discount_amount`) - `refund_amount`)) STORED,
  `order_status` enum('completed','cancelled','refunded','pending','shipped') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_method` enum('credit_card','debit_card','bank_transfer','pay_at_door') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_id` (`order_id`),
  KEY `idx_order_date` (`order_date`),
  KEY `idx_customer_pk` (`customer_pk_id`),
  KEY `idx_customer_external` (`customer_id`),
  KEY `idx_channel` (`channel`),
  KEY `idx_status` (`order_status`),
  KEY `idx_date_channel` (`order_date`,`channel`),
  KEY `idx_date_device` (`order_date`,`device`),
  KEY `idx_import` (`import_id`),
  CONSTRAINT `fk_orders_customer` FOREIGN KEY (`customer_pk_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_orders_import` FOREIGN KEY (`import_id`) REFERENCES `imports` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=41685 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_reset_tokens` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `token_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `purpose` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'reset',
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `requested_ip` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_token_hash` (`token_hash`),
  KEY `idx_user` (`user_id`),
  KEY `idx_expires` (`expires_at`),
  KEY `idx_user_purpose` (`user_id`, `purpose`),
  CONSTRAINT `fk_prt_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `permissions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `module` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_module` (`module`),
  KEY `idx_category` (`category`)
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `sku` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `product_name` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `sub_category` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `brand` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `gender` enum('male','female','unisex') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `price` decimal(15,2) NOT NULL,
  `cost_price` decimal(15,2) NOT NULL,
  `stock_quantity` int NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `color` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `size_range` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sku` (`sku`),
  KEY `idx_brand` (`brand`),
  KEY `idx_category` (`category`),
  KEY `idx_active` (`is_active`),
  KEY `idx_brand_category` (`brand`,`category`),
  KEY `idx_deleted` (`deleted_at`),
  KEY `fk_products_created_by` (`created_by`),
  KEY `fk_products_updated_by` (`updated_by`),
  CONSTRAINT `fk_products_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_products_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=805 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `refresh_tokens` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `token_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `device_info` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `issued_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime NOT NULL,
  `revoked_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_token_hash` (`token_hash`),
  KEY `idx_user` (`user_id`),
  KEY `idx_expires` (`expires_at`),
  KEY `idx_user_active` (`user_id`,`revoked_at`,`expires_at`),
  CONSTRAINT `fk_rt_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=54 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_permissions` (
  `role_id` bigint unsigned NOT NULL,
  `permission_id` bigint unsigned NOT NULL,
  `granted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `granted_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`role_id`,`permission_id`),
  KEY `idx_role` (`role_id`),
  KEY `idx_permission` (`permission_id`),
  KEY `fk_rp_granted_by` (`granted_by`),
  CONSTRAINT `fk_rp_granted_by` FOREIGN KEY (`granted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_rp_permission` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_rp_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `color` varchar(7) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `icon` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_system` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name` (`name`),
  KEY `idx_system` (`is_system`),
  KEY `idx_deleted` (`deleted_at`),
  KEY `fk_roles_created_by` (`created_by`),
  KEY `fk_roles_updated_by` (`updated_by`),
  CONSTRAINT `fk_roles_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_roles_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `saved_views` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `page` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `filters` json NOT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_page` (`user_id`,`page`),
  KEY `idx_deleted` (`deleted_at`),
  KEY `fk_sv_created_by` (`created_by`),
  KEY `fk_sv_updated_by` (`updated_by`),
  CONSTRAINT `fk_sv_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_sv_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_sv_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `segments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `rules` json NOT NULL,
  `cached_count` int DEFAULT NULL,
  `cached_at` datetime DEFAULT NULL,
  `is_shared` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_deleted` (`deleted_at`),
  KEY `fk_seg_created_by` (`created_by`),
  KEY `fk_seg_updated_by` (`updated_by`),
  CONSTRAINT `fk_seg_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_seg_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_seg_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_preferences` (
  `user_id` bigint unsigned NOT NULL,
  `theme` enum('light','dark','system') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'system',
  `language` enum('tr','en') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'tr',
  `sidebar_collapsed` tinyint(1) NOT NULL DEFAULT '0',
  `notifications_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_up_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `first_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `department` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `job_title` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avatar_url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role_id` bigint unsigned DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `deactivated_reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_login_at` datetime DEFAULT NULL,
  `last_login_ip` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `failed_login_attempts` int unsigned NOT NULL DEFAULT '0',
  `locked_until` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_email` (`email`),
  KEY `idx_role` (`role_id`),
  KEY `idx_active` (`is_active`),
  KEY `idx_deleted` (`deleted_at`),
  KEY `fk_users_created_by` (`created_by`),
  KEY `fk_users_updated_by` (`updated_by`),
  CONSTRAINT `fk_users_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_users_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

--
-- Seed data (permissions: 40, roles: 1 sistem rol, channel_mapping: 16)
--


LOCK TABLES `permissions` WRITE;
/*!40000 ALTER TABLE `permissions` DISABLE KEYS */;
INSERT INTO `permissions` VALUES (1,'dashboard.view','dashboard','view','Genel Özet sayfasını görme','view');
INSERT INTO `permissions` VALUES (2,'traffic.view','traffic','view','Trafik (GA4) sayfasını görme','view');
INSERT INTO `permissions` VALUES (3,'meta_ads.view','meta_ads','view','Meta Ads sayfasını görme','view');
INSERT INTO `permissions` VALUES (4,'google_ads.view','google_ads','view','Google Ads sayfasını görme','view');
INSERT INTO `permissions` VALUES (5,'ecommerce.view','ecommerce','view','E-Ticaret sayfasını görme','view');
INSERT INTO `permissions` VALUES (6,'campaigns.view','campaigns','view','Kampanyalar sayfasını görme','view');
INSERT INTO `permissions` VALUES (7,'funnel.view','funnel','view','Dönüşüm Hunisi sayfasını görme','view');
INSERT INTO `permissions` VALUES (8,'cohort.view','cohort','view','Müşteri Cohort sayfasını görme','view');
INSERT INTO `permissions` VALUES (9,'products.view','products','view','Ürünler sayfasını görme','view');
INSERT INTO `permissions` VALUES (10,'imports.view','imports','view','Import işlem geçmişini görme','data');
INSERT INTO `permissions` VALUES (11,'imports.create','imports','create','Yeni veri import etme','data');
INSERT INTO `permissions` VALUES (12,'imports.delete','imports','delete','Import kaydını silme','data');
INSERT INTO `permissions` VALUES (13,'mappings.view','mappings','view','Kanal eşlemelerini görme','data');
INSERT INTO `permissions` VALUES (14,'mappings.create','mappings','create','Yeni kanal eşlemesi oluşturma','data');
INSERT INTO `permissions` VALUES (15,'mappings.update','mappings','update','Kanal eşlemesi düzenleme','data');
INSERT INTO `permissions` VALUES (16,'mappings.delete','mappings','delete','Kanal eşlemesi silme','data');
INSERT INTO `permissions` VALUES (17,'segments.view','segments','view','Segmentleri görme','data');
INSERT INTO `permissions` VALUES (18,'segments.create','segments','create','Yeni segment oluşturma','data');
INSERT INTO `permissions` VALUES (19,'segments.update','segments','update','Segment düzenleme','data');
INSERT INTO `permissions` VALUES (20,'segments.delete','segments','delete','Segment silme','data');
INSERT INTO `permissions` VALUES (21,'views.view','views','view','Kayıtlı görünümleri görme','data');
INSERT INTO `permissions` VALUES (22,'views.create','views','create','Yeni görünüm oluşturma','data');
INSERT INTO `permissions` VALUES (23,'views.update','views','update','Görünüm düzenleme','data');
INSERT INTO `permissions` VALUES (24,'views.delete','views','delete','Görünüm silme','data');
INSERT INTO `permissions` VALUES (25,'export.csv','export','csv','Veriyi CSV formatında dışa aktarma','data');
INSERT INTO `permissions` VALUES (26,'export.report','export','report','PDF/Excel rapor dışa aktarma','data');
INSERT INTO `permissions` VALUES (27,'users.view','users','view','Kullanıcı listesini görme','admin');
INSERT INTO `permissions` VALUES (28,'users.create','users','create','Yeni kullanıcı oluşturma','admin');
INSERT INTO `permissions` VALUES (29,'users.update','users','update','Kullanıcı bilgilerini düzenleme','admin');
INSERT INTO `permissions` VALUES (30,'users.delete','users','delete','Kullanıcı silme','admin');
INSERT INTO `permissions` VALUES (31,'users.reset_password','users','reset_password','Kullanıcı şifresini sıfırlama','admin');
INSERT INTO `permissions` VALUES (32,'roles.view','roles','view','Rol listesini görme','admin');
INSERT INTO `permissions` VALUES (33,'roles.create','roles','create','Yeni rol oluşturma','admin');
INSERT INTO `permissions` VALUES (34,'roles.update','roles','update','Rol düzenleme','admin');
INSERT INTO `permissions` VALUES (35,'roles.delete','roles','delete','Rol silme','admin');
INSERT INTO `permissions` VALUES (36,'logs.view_api','logs','view_api','API erişim loglarını görme','system');
INSERT INTO `permissions` VALUES (37,'logs.view_audit','logs','view_audit','Denetim loglarını görme','system');
INSERT INTO `permissions` VALUES (38,'logs.view_imports','logs','view_imports','Import detay loglarını görme','system');
INSERT INTO `permissions` VALUES (39,'settings.view','settings','view','Sistem ayarlarını görme','system');
INSERT INTO `permissions` VALUES (40,'settings.update','settings','update','Sistem ayarlarını düzenleme','system');
/*!40000 ALTER TABLE `permissions` ENABLE KEYS */;
UNLOCK TABLES;

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'Süper Admin','Sistem yöneticisi - tüm yetkilere otomatik sahip','#E63946','👑',1,'2026-05-03 10:50:33',NULL,'2026-05-03 10:50:33',NULL,NULL);
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

LOCK TABLES `channel_mapping` WRITE;
/*!40000 ALTER TABLE `channel_mapping` DISABLE KEYS */;
INSERT INTO `channel_mapping` VALUES (1,'google','organic','Organic Search',0,NULL,'2026-05-03 10:50:33',NULL,'2026-05-03 10:50:33',NULL,NULL);
INSERT INTO `channel_mapping` VALUES (2,'google','cpc','Paid Search',0,NULL,'2026-05-03 10:50:33',NULL,'2026-05-03 10:50:33',NULL,NULL);
INSERT INTO `channel_mapping` VALUES (3,'bing','organic','Organic Search',0,NULL,'2026-05-03 10:50:33',NULL,'2026-05-03 10:50:33',NULL,NULL);
INSERT INTO `channel_mapping` VALUES (4,'bing','cpc','Paid Search',0,NULL,'2026-05-03 10:50:33',NULL,'2026-05-03 10:50:33',NULL,NULL);
INSERT INTO `channel_mapping` VALUES (5,'facebook','cpc','Paid Social',0,NULL,'2026-05-03 10:50:33',NULL,'2026-05-03 10:50:33',NULL,NULL);
INSERT INTO `channel_mapping` VALUES (6,'facebook','social','Organic Social',0,NULL,'2026-05-03 10:50:33',NULL,'2026-05-03 10:50:33',NULL,NULL);
INSERT INTO `channel_mapping` VALUES (7,'instagram','cpc','Paid Social',0,NULL,'2026-05-03 10:50:33',NULL,'2026-05-03 10:50:33',NULL,NULL);
INSERT INTO `channel_mapping` VALUES (8,'instagram','social','Organic Social',0,NULL,'2026-05-03 10:50:33',NULL,'2026-05-03 10:50:33',NULL,NULL);
INSERT INTO `channel_mapping` VALUES (9,'(direct)','(none)','Direct',0,NULL,'2026-05-03 10:50:33',NULL,'2026-05-03 10:50:33',NULL,NULL);
INSERT INTO `channel_mapping` VALUES (10,'newsletter','email','Email',0,NULL,'2026-05-03 10:50:33',NULL,'2026-05-03 10:50:33',NULL,NULL);
INSERT INTO `channel_mapping` VALUES (11,'youtube.com','cpc','Paid Video',0,NULL,'2026-05-03 10:50:33',NULL,'2026-05-03 10:50:33',NULL,NULL);
INSERT INTO `channel_mapping` VALUES (12,'youtube.com','organic','Organic Video',0,NULL,'2026-05-03 10:50:33',NULL,'2026-05-03 10:50:33',NULL,NULL);
INSERT INTO `channel_mapping` VALUES (13,'blog.sporthink.com.tr','referral','Referral',0,NULL,'2026-05-03 19:31:02',NULL,'2026-05-03 19:31:02',NULL,NULL);
INSERT INTO `channel_mapping` VALUES (14,'trendyol.com','referral','Referral',0,NULL,'2026-05-03 19:31:02',NULL,'2026-05-03 19:31:02',NULL,NULL);
INSERT INTO `channel_mapping` VALUES (15,'twitter.com','social','Organic Social',0,NULL,'2026-05-03 19:31:02',NULL,'2026-05-03 19:31:02',NULL,NULL);
INSERT INTO `channel_mapping` VALUES (16,'whatsapp.com','referral','Referral',0,NULL,'2026-05-03 19:31:02',NULL,'2026-05-03 19:31:02',NULL,NULL);
/*!40000 ALTER TABLE `channel_mapping` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;


/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;


-- MySQL dump 10.13  Distrib 8.4.0, for macos13.2 (arm64)
--
-- Host: 127.0.0.1    Database: sporthink
-- ------------------------------------------------------
-- Server version	9.5.0

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

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned DEFAULT NULL,
  `user_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `resource_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `resource_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `details` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_action` (`action`),
  KEY `idx_resource` (`resource_type`,`resource_id`),
  KEY `idx_created` (`created_at`),
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `campaigns`
--

DROP TABLE IF EXISTS `campaigns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `campaigns` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `platform` enum('meta','google') COLLATE utf8mb4_unicode_ci NOT NULL,
  `external_campaign_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `campaign_name` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `campaign_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `objective` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `daily_budget` decimal(15,2) DEFAULT NULL,
  `total_budget` decimal(15,2) DEFAULT NULL,
  `target_audience` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('active','paused','completed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `campaigns`
--

LOCK TABLES `campaigns` WRITE;
/*!40000 ALTER TABLE `campaigns` DISABLE KEYS */;
/*!40000 ALTER TABLE `campaigns` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `channel_mapping`
--

DROP TABLE IF EXISTS `channel_mapping`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `channel_mapping` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `source` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `medium` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `channel_group` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_auto_assigned` tinyint(1) NOT NULL DEFAULT '0',
  `notes` text COLLATE utf8mb4_unicode_ci,
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
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `channel_mapping`
--

LOCK TABLES `channel_mapping` WRITE;
/*!40000 ALTER TABLE `channel_mapping` DISABLE KEYS */;
INSERT INTO `channel_mapping` VALUES (1,'google','organic','Organic Search',0,NULL,'2026-05-03 10:50:33',NULL,'2026-05-03 10:50:33',NULL,NULL),(2,'google','cpc','Paid Search',0,NULL,'2026-05-03 10:50:33',NULL,'2026-05-03 10:50:33',NULL,NULL),(3,'bing','organic','Organic Search',0,NULL,'2026-05-03 10:50:33',NULL,'2026-05-03 10:50:33',NULL,NULL),(4,'bing','cpc','Paid Search',0,NULL,'2026-05-03 10:50:33',NULL,'2026-05-03 10:50:33',NULL,NULL),(5,'facebook','cpc','Paid Social',0,NULL,'2026-05-03 10:50:33',NULL,'2026-05-03 10:50:33',NULL,NULL),(6,'facebook','social','Organic Social',0,NULL,'2026-05-03 10:50:33',NULL,'2026-05-03 10:50:33',NULL,NULL),(7,'instagram','cpc','Paid Social',0,NULL,'2026-05-03 10:50:33',NULL,'2026-05-03 10:50:33',NULL,NULL),(8,'instagram','social','Organic Social',0,NULL,'2026-05-03 10:50:33',NULL,'2026-05-03 10:50:33',NULL,NULL),(9,'(direct)','(none)','Direct',0,NULL,'2026-05-03 10:50:33',NULL,'2026-05-03 10:50:33',NULL,NULL),(10,'newsletter','email','Email',0,NULL,'2026-05-03 10:50:33',NULL,'2026-05-03 10:50:33',NULL,NULL),(11,'youtube.com','cpc','Paid Video',0,NULL,'2026-05-03 10:50:33',NULL,'2026-05-03 10:50:33',NULL,NULL),(12,'youtube.com','organic','Organic Video',0,NULL,'2026-05-03 10:50:33',NULL,'2026-05-03 10:50:33',NULL,NULL);
/*!40000 ALTER TABLE `channel_mapping` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customers` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `customer_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `first_order_date` date NOT NULL,
  `registration_date` date NOT NULL,
  `city` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gender` enum('male','female') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `age_group` enum('18-24','25-34','35-44','45-54','55-64','65+') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `registration_source` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customers`
--

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ga4_item_engagement`
--

DROP TABLE IF EXISTS `ga4_item_engagement`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ga4_item_engagement` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `import_id` bigint unsigned NOT NULL,
  `date` date NOT NULL,
  `product_pk_id` bigint unsigned DEFAULT NULL,
  `item_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_name` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `item_category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `item_category2` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `item_brand` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ga4_item_engagement`
--

LOCK TABLES `ga4_item_engagement` WRITE;
/*!40000 ALTER TABLE `ga4_item_engagement` DISABLE KEYS */;
/*!40000 ALTER TABLE `ga4_item_engagement` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ga4_traffic`
--

DROP TABLE IF EXISTS `ga4_traffic`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ga4_traffic` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `import_id` bigint unsigned NOT NULL,
  `date` date NOT NULL,
  `session_source` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `session_medium` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `session_campaign_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `session_default_channel_group` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `derived_channel` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `device_category` enum('mobile','desktop','tablet','other') COLLATE utf8mb4_unicode_ci NOT NULL,
  `city` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `landing_page_plus_query_string` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_vs_returning` enum('new','returning') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ga4_traffic`
--

LOCK TABLES `ga4_traffic` WRITE;
/*!40000 ALTER TABLE `ga4_traffic` DISABLE KEYS */;
/*!40000 ALTER TABLE `ga4_traffic` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `google_ads`
--

DROP TABLE IF EXISTS `google_ads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `google_ads` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `import_id` bigint unsigned NOT NULL,
  `date` date NOT NULL,
  `customer_id` bigint DEFAULT NULL,
  `customer_descriptive_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `campaign_pk_id` bigint unsigned DEFAULT NULL,
  `campaign_id` bigint NOT NULL,
  `campaign_name` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `campaign_status` enum('enabled','paused','removed') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `advertising_channel_type` enum('search','shopping','performance_max','display','video') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ad_group_id` bigint DEFAULT NULL,
  `ad_group_name` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ad_group_status` enum('enabled','paused','removed') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `device` enum('mobile','desktop','tablet','other') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ad_network_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `conversion_action_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `product_item_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `product_title` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `product_brand` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `product_type_l1` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `product_type_l2` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `keyword_text` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `keyword_match_type` enum('exact','phrase','broad') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `search_term` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `google_ads`
--

LOCK TABLES `google_ads` WRITE;
/*!40000 ALTER TABLE `google_ads` DISABLE KEYS */;
/*!40000 ALTER TABLE `google_ads` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `import_errors`
--

DROP TABLE IF EXISTS `import_errors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `import_errors` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `import_id` bigint unsigned NOT NULL,
  `source_row_number` int unsigned NOT NULL,
  `field_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `error_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `row_data` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_import` (`import_id`),
  KEY `idx_error_code` (`error_code`),
  CONSTRAINT `fk_ie_import` FOREIGN KEY (`import_id`) REFERENCES `imports` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `import_errors`
--

LOCK TABLES `import_errors` WRITE;
/*!40000 ALTER TABLE `import_errors` DISABLE KEYS */;
/*!40000 ALTER TABLE `import_errors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `imports`
--

DROP TABLE IF EXISTS `imports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `imports` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned DEFAULT NULL,
  `file_name` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_path` varchar(1000) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_size` bigint unsigned NOT NULL,
  `file_format` enum('csv','xlsx','json') COLLATE utf8mb4_unicode_ci NOT NULL,
  `data_type` enum('ga4_traffic','ga4_items','meta_ads','meta_breakdowns','google_ads','orders','order_items','products','customers','campaigns') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','parsing','validating','committing','completed','failed','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `progress_percentage` int NOT NULL DEFAULT '0',
  `total_rows` int DEFAULT NULL,
  `valid_rows` int DEFAULT NULL,
  `invalid_rows` int DEFAULT NULL,
  `skipped_rows` int DEFAULT NULL,
  `inserted_rows` int DEFAULT NULL,
  `duplicate_strategy` enum('overwrite','skip','cancel') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `error_strategy` enum('skip','abort','ask') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `column_mapping` json DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `imports`
--

LOCK TABLES `imports` WRITE;
/*!40000 ALTER TABLE `imports` DISABLE KEYS */;
/*!40000 ALTER TABLE `imports` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `kpi_campaign_aggregates`
--

DROP TABLE IF EXISTS `kpi_campaign_aggregates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kpi_campaign_aggregates` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `campaign_pk_id` bigint unsigned NOT NULL,
  `campaign_external_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `campaign_name` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `platform` enum('meta','google') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
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

--
-- Dumping data for table `kpi_campaign_aggregates`
--

LOCK TABLES `kpi_campaign_aggregates` WRITE;
/*!40000 ALTER TABLE `kpi_campaign_aggregates` DISABLE KEYS */;
/*!40000 ALTER TABLE `kpi_campaign_aggregates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `kpi_daily_aggregates`
--

DROP TABLE IF EXISTS `kpi_daily_aggregates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kpi_daily_aggregates` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `channel` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `platform` enum('ga4','meta','google','ecommerce') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `device` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
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
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_date_channel_platform_device` (`date`,`channel`,`platform`,`device`),
  KEY `idx_date` (`date`),
  KEY `idx_date_channel` (`date`,`channel`),
  KEY `idx_date_platform` (`date`,`platform`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `kpi_daily_aggregates`
--

LOCK TABLES `kpi_daily_aggregates` WRITE;
/*!40000 ALTER TABLE `kpi_daily_aggregates` DISABLE KEYS */;
/*!40000 ALTER TABLE `kpi_daily_aggregates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `kpi_monthly_aggregates`
--

DROP TABLE IF EXISTS `kpi_monthly_aggregates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kpi_monthly_aggregates` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `period_month` date NOT NULL,
  `channel` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `platform` enum('ga4','meta','google','ecommerce') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `device` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
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

--
-- Dumping data for table `kpi_monthly_aggregates`
--

LOCK TABLES `kpi_monthly_aggregates` WRITE;
/*!40000 ALTER TABLE `kpi_monthly_aggregates` DISABLE KEYS */;
/*!40000 ALTER TABLE `kpi_monthly_aggregates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `meta_ads`
--

DROP TABLE IF EXISTS `meta_ads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `meta_ads` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `import_id` bigint unsigned NOT NULL,
  `date_start` date NOT NULL,
  `date_stop` date NOT NULL,
  `account_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `account_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `campaign_pk_id` bigint unsigned DEFAULT NULL,
  `campaign_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `campaign_name` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `adset_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `adset_name` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ad_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ad_name` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `objective` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `buying_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `meta_ads`
--

LOCK TABLES `meta_ads` WRITE;
/*!40000 ALTER TABLE `meta_ads` DISABLE KEYS */;
/*!40000 ALTER TABLE `meta_ads` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `meta_ads_breakdowns`
--

DROP TABLE IF EXISTS `meta_ads_breakdowns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `meta_ads_breakdowns` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `import_id` bigint unsigned NOT NULL,
  `date_start` date NOT NULL,
  `campaign_pk_id` bigint unsigned DEFAULT NULL,
  `campaign_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `adset_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `age` enum('13-17','18-24','25-34','35-44','45-54','55-64','65+','unknown') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gender` enum('male','female','unknown') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `publisher_platform` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `platform_position` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `impression_device` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `country` varchar(2) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `region` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `meta_ads_breakdowns`
--

LOCK TABLES `meta_ads_breakdowns` WRITE;
/*!40000 ALTER TABLE `meta_ads_breakdowns` DISABLE KEYS */;
/*!40000 ALTER TABLE `meta_ads_breakdowns` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `order_items`
--

DROP TABLE IF EXISTS `order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `import_id` bigint unsigned NOT NULL,
  `order_pk_id` bigint unsigned NOT NULL,
  `order_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `line_id` int unsigned NOT NULL,
  `product_pk_id` bigint unsigned DEFAULT NULL,
  `item_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_name` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `item_category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `item_category2` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `item_brand` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_items`
--

LOCK TABLES `order_items` WRITE;
/*!40000 ALTER TABLE `order_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `order_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `import_id` bigint unsigned NOT NULL,
  `order_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `order_date` datetime NOT NULL,
  `customer_pk_id` bigint unsigned NOT NULL,
  `customer_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `city` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `device` enum('mobile','desktop','tablet') COLLATE utf8mb4_unicode_ci NOT NULL,
  `channel` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `medium` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `campaign_name` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `coupon_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `product_count` int unsigned NOT NULL DEFAULT '0',
  `order_revenue` decimal(15,2) NOT NULL,
  `shipping_cost` decimal(10,2) NOT NULL DEFAULT '0.00',
  `discount_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `refund_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `net_revenue` decimal(15,2) GENERATED ALWAYS AS (((`order_revenue` - `discount_amount`) - `refund_amount`)) STORED,
  `order_status` enum('completed','cancelled','refunded','pending','shipped') COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_method` enum('credit_card','debit_card','bank_transfer','pay_at_door') COLLATE utf8mb4_unicode_ci NOT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `password_reset_tokens`
--

DROP TABLE IF EXISTS `password_reset_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_reset_tokens` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `token_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `requested_ip` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_token_hash` (`token_hash`),
  KEY `idx_user` (`user_id`),
  KEY `idx_expires` (`expires_at`),
  CONSTRAINT `fk_prt_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `password_reset_tokens`
--

LOCK TABLES `password_reset_tokens` WRITE;
/*!40000 ALTER TABLE `password_reset_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `password_reset_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `permissions`
--

DROP TABLE IF EXISTS `permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `permissions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `module` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_module` (`module`),
  KEY `idx_category` (`category`)
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permissions`
--

LOCK TABLES `permissions` WRITE;
/*!40000 ALTER TABLE `permissions` DISABLE KEYS */;
INSERT INTO `permissions` VALUES (1,'dashboard.view','dashboard','view','Genel Özet sayfasını görüntüleme','view'),(2,'traffic.view','traffic','view','Trafik (GA4) sayfasını görüntüleme','view'),(3,'meta_ads.view','meta_ads','view','Meta Ads sayfasını görüntüleme','view'),(4,'google_ads.view','google_ads','view','Google Ads sayfasını görüntüleme','view'),(5,'ecommerce.view','ecommerce','view','E-Ticaret sayfasını görüntüleme','view'),(6,'campaigns.view','campaigns','view','Kampanyalar sayfasını görüntüleme','view'),(7,'funnel.view','funnel','view','Funnel analiz sayfasını görüntüleme','view'),(8,'cohort.view','cohort','view','Cohort analiz sayfasını görüntüleme','view'),(9,'products.view','products','view','Ürünler sayfasını görüntüleme','view'),(10,'imports.view','imports','view','Import gecmisini görüntüleme','data'),(11,'imports.create','imports','create','Yeni veri import etme','data'),(12,'imports.delete','imports','delete','Import silme','data'),(13,'mappings.view','mappings','view','Kanal eslemelerini görüntüleme','data'),(14,'mappings.create','mappings','create','Yeni kanal eslemesi olusturma','data'),(15,'mappings.update','mappings','update','Kanal eslemesi düzenleme','data'),(16,'mappings.delete','mappings','delete','Kanal eslemesi silme','data'),(17,'segments.view','segments','view','Segmentleri görüntüleme','data'),(18,'segments.create','segments','create','Yeni segment olusturma','data'),(19,'segments.update','segments','update','Segment düzenleme','data'),(20,'segments.delete','segments','delete','Segment silme','data'),(21,'views.view','views','view','Kayitli görünümleri görme','data'),(22,'views.create','views','create','Yeni görünüm kaydetme','data'),(23,'views.update','views','update','Görünüm düzenleme','data'),(24,'views.delete','views','delete','Görünüm silme','data'),(25,'export.csv','export','csv','CSV olarak dısa aktarma','data'),(26,'export.report','export','report','PDF rapor olusturma','data'),(27,'users.view','users','view','Kullanicilari görüntüleme','admin'),(28,'users.create','users','create','Yeni kullanici olusturma','admin'),(29,'users.update','users','update','Kullanici düzenleme','admin'),(30,'users.delete','users','delete','Kullanici silme','admin'),(31,'users.reset_password','users','reset_password','Kullanici sifresini sifirlama','admin'),(32,'roles.view','roles','view','Rolleri görüntüleme','admin'),(33,'roles.create','roles','create','Yeni rol olusturma','admin'),(34,'roles.update','roles','update','Rol düzenleme','admin'),(35,'roles.delete','roles','delete','Rol silme','admin'),(36,'logs.view_api','logs','view_api','API request loglarini görme','system'),(37,'logs.view_audit','logs','view_audit','Audit loglarini görme','system'),(38,'logs.view_imports','logs','view_imports','Import loglarini görme','system'),(39,'settings.view','settings','view','Sistem ayarlarini görme','system'),(40,'settings.update','settings','update','Sistem ayarlarini düzenleme','system');
/*!40000 ALTER TABLE `permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `sku` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `product_name` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sub_category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `brand` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `gender` enum('male','female','unisex') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `price` decimal(15,2) NOT NULL,
  `cost_price` decimal(15,2) NOT NULL,
  `stock_quantity` int NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `color` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `size_range` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `refresh_tokens`
--

DROP TABLE IF EXISTS `refresh_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `refresh_tokens` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `token_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `device_info` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `issued_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime NOT NULL,
  `revoked_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_token_hash` (`token_hash`),
  KEY `idx_user` (`user_id`),
  KEY `idx_expires` (`expires_at`),
  KEY `idx_user_active` (`user_id`,`revoked_at`,`expires_at`),
  CONSTRAINT `fk_rt_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `refresh_tokens`
--

LOCK TABLES `refresh_tokens` WRITE;
/*!40000 ALTER TABLE `refresh_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `refresh_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_permissions`
--

DROP TABLE IF EXISTS `role_permissions`;
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

--
-- Dumping data for table `role_permissions`
--

LOCK TABLES `role_permissions` WRITE;
/*!40000 ALTER TABLE `role_permissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `role_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `color` varchar(7) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `icon` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
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

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'Süper Admin','Sistem yöneticisi - tüm yetkilere otomatik sahip','#E63946','👑',1,'2026-05-03 10:50:33',NULL,'2026-05-03 10:50:33',NULL,NULL);
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `saved_views`
--

DROP TABLE IF EXISTS `saved_views`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `saved_views` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `page` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
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

--
-- Dumping data for table `saved_views`
--

LOCK TABLES `saved_views` WRITE;
/*!40000 ALTER TABLE `saved_views` DISABLE KEYS */;
/*!40000 ALTER TABLE `saved_views` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `segments`
--

DROP TABLE IF EXISTS `segments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `segments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
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

--
-- Dumping data for table `segments`
--

LOCK TABLES `segments` WRITE;
/*!40000 ALTER TABLE `segments` DISABLE KEYS */;
/*!40000 ALTER TABLE `segments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_preferences`
--

DROP TABLE IF EXISTS `user_preferences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_preferences` (
  `user_id` bigint unsigned NOT NULL,
  `theme` enum('light','dark','system') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'system',
  `language` enum('tr','en') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'tr',
  `sidebar_collapsed` tinyint(1) NOT NULL DEFAULT '0',
  `notifications_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_up_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_preferences`
--

LOCK TABLES `user_preferences` WRITE;
/*!40000 ALTER TABLE `user_preferences` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_preferences` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `first_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `department` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `job_title` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avatar_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role_id` bigint unsigned DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `deactivated_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_login_at` datetime DEFAULT NULL,
  `last_login_ip` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'sporthink'
--

--
-- Dumping routines for database 'sporthink'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-03 14:36:46

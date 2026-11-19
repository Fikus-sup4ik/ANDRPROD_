(function () {
    'use strict';

    /**
     * ANDRPROD v3.0 — Единый центр управления онлайн-плагинами и единого поиска видео для Lampa
     * Совместимость: Lampa 1.x / 2.x / 3.x, Android TV, Smart TV (Tizen / webOS), Desktop (ES5)
     *
     * Архитектура модулей:
     * 1.  BrandIcons           — крупный чёткий прозрачный логотип ANDRPROD для ТВ и иконки плагинов.
     * 2.  StorageManager       — сохранение настроек, избранного, приоритетов, фильтров и «Лучшего выбора».
     * 3.  TitleResolver        — корректное извлечение названий фильмов и сериалов (без ошибки отсутствия EN).
     * 4.  PluginAdapterEngine  — обнаружение внутренних источников плагинов (/lite/events, Lampa.Api.sources, адаптеры).
     * 5.  SourceRegistry       — реестр установленных плагинов и их реальных источников.
     * 6.  FilterEngine         — одновременная многокритериальная фильтрация и сортировка по реальным данным.
     * 7.  HealthChecker        — проверка доступности плагинов и источников с тайм-аутами.
     * 8.  BestChoiceEngine     — реальный расчёт «Лучшего выбора» (без угадывания и без привязки только к скорости).
     * 9.  UnifiedSearchEngine  — единый поиск по всем поддерживаемым онлайн-плагинам с изоляцией ошибок и дедупликацией.
     * 10. CardIntegration      — большая прозрачная кнопка ANDRPROD в карточке фильма/сериала (не трогает другие блоки Lampa).
     * 11. AndrprodSearchComponent — экран единого поиска (Ручной / Автоматический / Лучший выбор / Повтор проблемного плагина).
     * 12. AndrprodHubComponent — центр управления плагинами, страница плагина, общий каталог «Все источники», настройки.
     * 13. SettingsIntegration  — нативный раздел в Lampa.SettingsApi.
     */

    if (window.andrprod_plugin_loaded) return;
    window.andrprod_plugin_loaded = true;

    var PLUGIN_ID = 'andrprod';
    var PLUGIN_VERSION = '3.0.0';
    var HUB_COMPONENT = 'andrprod_hub';
    var SEARCH_COMPONENT = 'andrprod_search';

    // =========================================================================
    // 1. ПРОЗРАЧНЫЙ ЛОГОТИП ANDRPROD И ИКОНКИ ПЛАГИНОВ (BrandIcons)
    // =========================================================================
    var BrandIcons = {
        getLogoSvg: function (className, uid) {
            var gradId = 'andrprod_grad_' + (uid || 'main');
            return (
                '<svg class="andrprod-logo-svg ' + (className || '') + '" viewBox="0 0 340 58" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-label="ANDRPROD" role="img">' +
                    '<defs>' +
                        '<linearGradient id="' + gradId + '" x1="0%" y1="0%" x2="100%" y2="0%">' +
                            '<stop offset="0%" stop-color="#7DD3FC"/>' +
                            '<stop offset="45%" stop-color="#38BDF8"/>' +
                            '<stop offset="100%" stop-color="#2563EB"/>' +
                        '</linearGradient>' +
                    '</defs>' +
                    '<text x="170" y="44" text-anchor="middle" fill="url(#' + gradId + ')" ' +
                        'text-rendering="geometricPrecision" ' +
                        'font-family="\'Segoe UI\', \'Roboto\', \'Helvetica Neue\', Arial, sans-serif" ' +
                        'font-size="44" font-weight="900" letter-spacing="4">ANDRPROD</text>' +
                '</svg>'
            );
        },

        getMiniIconSvg: function () {
            return (
                '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none">' +
                    '<path d="M4 18L10.5 5H13.5L20 18H16.8L15.4 15H8.6L7.2 18H4ZM9.7 12.4H14.3L12 7.5L9.7 12.4Z" fill="#38BDF8"/>' +
                '</svg>'
            );
        },

        getPluginIconHtml: function (plugin) {
            if (plugin && plugin.nativeIcon) {
                var raw = String(plugin.nativeIcon);
                if (raw.indexOf('<svg') !== -1) {
                    return '<div class="andrprod-plugin-icon is-native">' + raw + '</div>';
                }
                if (raw.indexOf('http') === 0 || raw.indexOf('data:image') === 0) {
                    return (
                        '<div class="andrprod-plugin-icon is-native">' +
                            '<img src="' + escapeHtml(raw) + '" alt="' + escapeHtml(plugin.name || '') + '"/>' +
                        '</div>'
                    );
                }
            }

            var name = (plugin && plugin.name) ? String(plugin.name) : 'PL';
            var abbr = BrandIcons._makeAbbreviation(name);
            var accent = BrandIcons._pickAccentColor(plugin ? plugin.id : name);

            return (
                '<div class="andrprod-plugin-icon" style="border-color:' + accent + '44;background:' + accent + '1A;">' +
                    '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">' +
                        '<text x="24" y="30" text-anchor="middle" fill="' + accent + '" ' +
                            'font-family="\'Segoe UI\', Roboto, Arial, sans-serif" ' +
                            'font-size="' + (abbr.length > 2 ? '15' : '18') + '" font-weight="800" letter-spacing="0.8">' +
                            escapeHtml(abbr) +
                        '</text>' +
                    '</svg>' +
                '</div>'
            );
        },

        _makeAbbreviation: function (name) {
            var clean = $.trim(String(name || '').replace(/[^a-zA-Zа-яА-ЯёЁ0-9\s]/g, ' ').replace(/\s+/g, ' '));
            if (!clean) return 'PL';
            var words = clean.split(' ');
            if (words.length >= 2) return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
            if (clean.length <= 3) return clean.toUpperCase();
            return clean.slice(0, 2).toUpperCase();
        },

        _pickAccentColor: function (seed) {
            var palette = ['#38BDF8', '#60A5FA', '#34D399', '#A78BFA', '#22D3EE', '#818CF8', '#2DD4BF'];
            var hash = 0;
            var s = String(seed || '');
            var i;
            for (i = 0; i < s.length; i++) {
                hash = ((hash << 5) - hash) + s.charCodeAt(i);
                hash |= 0;
            }
            return palette[Math.abs(hash) % palette.length];
        }
    };

    // =========================================================================
    // 2. ХРАНИЛИЩЕ НАСТРОЕК (StorageManager / Config)
    // =========================================================================
    var STORAGE_KEYS = {
        mode: 'andrprod_mode',                        // 'manual' | 'auto'
        bestChoice: 'andrprod_best_choice',           // true | false
        autoSearch: 'andrprod_auto_search',           // true | false
        hideBroken: 'andrprod_hide_broken',           // true | false
        timeout: 'andrprod_timeout_ms',               // 3000 | 5000 | 8000 | 12000
        disabled: 'andrprod_disabled_sources',        // { key: true }
        disabledPlugins: 'andrprod_disabled_plugins', // { pluginId: true }
        favorites: 'andrprod_favorite_sources',       // { key: true }
        favoritePlugins: 'andrprod_favorite_plugins', // { pluginId: true }
        priorities: 'andrprod_source_priorities',     // [key1, key2, ...]
        filters: 'andrprod_filters_v2'                // FilterState
    };

    function getDefaultFilters() {
        return {
            quality: 'all',
            contentType: 'all',
            pluginId: 'all',
            onlyWorking: false,
            onlyFavorites: false,
            only4k: false,
            onlyFullHd: false,
            hideUnavailable: false,
            sortBy: 'priority',
            searchQuery: ''
        };
    }

    var StorageManager = {
        get: function (key, defVal) {
            try {
                var val = Lampa.Storage.get(key, defVal);
                return typeof val === 'undefined' || val === null ? defVal : val;
            } catch (e) {
                return defVal;
            }
        },
        set: function (key, val) {
            try {
                Lampa.Storage.set(key, val);
            } catch (e) {}
        },
        getMode: function () {
            return StorageManager.get(STORAGE_KEYS.mode, 'manual');
        },
        setMode: function (mode) {
            StorageManager.set(STORAGE_KEYS.mode, mode === 'auto' ? 'auto' : 'manual');
        },
        isBestChoice: function () {
            var v = StorageManager.get(STORAGE_KEYS.bestChoice, false);
            return v === true || v === 'true';
        },
        setBestChoice: function (flag) {
            StorageManager.set(STORAGE_KEYS.bestChoice, !!flag);
        },
        isAutoSearch: function () {
            var v = StorageManager.get(STORAGE_KEYS.autoSearch, true);
            return v === true || v === 'true';
        },
        setAutoSearch: function (flag) {
            StorageManager.set(STORAGE_KEYS.autoSearch, !!flag);
        },
        isHideBroken: function () {
            var v = StorageManager.get(STORAGE_KEYS.hideBroken, false);
            return v === true || v === 'true';
        },
        setHideBroken: function (flag) {
            StorageManager.set(STORAGE_KEYS.hideBroken, !!flag);
        },
        getTimeout: function () {
            var t = parseInt(StorageManager.get(STORAGE_KEYS.timeout, 6000), 10);
            if (isNaN(t) || t < 2000 || t > 20000) return 6000;
            return t;
        },
        setTimeoutMs: function (ms) {
            StorageManager.set(STORAGE_KEYS.timeout, parseInt(ms, 10) || 6000);
        },
        getDisabledMap: function () {
            var m = StorageManager.get(STORAGE_KEYS.disabled, {});
            return m && typeof m === 'object' ? m : {};
        },
        isEnabled: function (sourceKey) {
            return !StorageManager.getDisabledMap()[sourceKey];
        },
        setEnabled: function (sourceKey, enabled) {
            var m = StorageManager.getDisabledMap();
            if (enabled) delete m[sourceKey];
            else m[sourceKey] = true;
            StorageManager.set(STORAGE_KEYS.disabled, m);
        },
        getFavoritesMap: function () {
            var m = StorageManager.get(STORAGE_KEYS.favorites, {});
            return m && typeof m === 'object' ? m : {};
        },
        isFavorite: function (sourceKey) {
            return !!StorageManager.getFavoritesMap()[sourceKey];
        },
        toggleFavorite: function (sourceKey) {
            var m = StorageManager.getFavoritesMap();
            if (m[sourceKey]) delete m[sourceKey];
            else m[sourceKey] = true;
            StorageManager.set(STORAGE_KEYS.favorites, m);
            return !!m[sourceKey];
        },
        getDisabledPluginsMap: function () {
            var m = StorageManager.get(STORAGE_KEYS.disabledPlugins, {});
            return m && typeof m === 'object' ? m : {};
        },
        isPluginEnabled: function (pluginId) {
            return !StorageManager.getDisabledPluginsMap()[pluginId];
        },
        setPluginEnabled: function (pluginId, enabled) {
            var m = StorageManager.getDisabledPluginsMap();
            if (enabled) delete m[pluginId];
            else m[pluginId] = true;
            StorageManager.set(STORAGE_KEYS.disabledPlugins, m);
        },
        getFavoritePluginsMap: function () {
            var m = StorageManager.get(STORAGE_KEYS.favoritePlugins, {});
            return m && typeof m === 'object' ? m : {};
        },
        isPluginFavorite: function (pluginId) {
            return !!StorageManager.getFavoritePluginsMap()[pluginId];
        },
        togglePluginFavorite: function (pluginId) {
            var m = StorageManager.getFavoritePluginsMap();
            if (m[pluginId]) delete m[pluginId];
            else m[pluginId] = true;
            StorageManager.set(STORAGE_KEYS.favoritePlugins, m);
            return !!m[pluginId];
        },
        getPriorities: function () {
            var arr = StorageManager.get(STORAGE_KEYS.priorities, []);
            return Object.prototype.toString.call(arr) === '[object Array]' ? arr : [];
        },
        setPriorities: function (arr) {
            StorageManager.set(STORAGE_KEYS.priorities, arr || []);
        },
        movePriority: function (sourceKey, direction) {
            var list = SourceRegistry.getAllSources();
            var ids = [];
            var i;
            for (i = 0; i < list.length; i++) ids.push(list[i].key);
            var idx = ids.indexOf(sourceKey);
            if (idx === -1) return false;
            var target = idx + direction;
            if (target < 0 || target >= ids.length) return false;
            var tmp = ids[idx];
            ids[idx] = ids[target];
            ids[target] = tmp;
            StorageManager.setPriorities(ids);
            return true;
        },
        getFilters: function () {
            var def = getDefaultFilters();
            var saved = StorageManager.get(STORAGE_KEYS.filters, null);
            if (!saved || typeof saved !== 'object') return def;
            var k;
            for (k in def) {
                if (def.hasOwnProperty(k) && typeof saved[k] !== 'undefined') {
                    def[k] = saved[k];
                }
            }
            return def;
        },
        setFilters: function (patch) {
            var cur = StorageManager.getFilters();
            var k;
            if (patch && typeof patch === 'object') {
                for (k in patch) {
                    if (patch.hasOwnProperty(k)) cur[k] = patch[k];
                }
            }
            StorageManager.set(STORAGE_KEYS.filters, cur);
            return cur;
        },
        resetFilters: function () {
            var def = getDefaultFilters();
            StorageManager.set(STORAGE_KEYS.filters, def);
            return def;
        }
    };

    var Config = StorageManager;

    // =========================================================================
    // 3. РАЗРЕШЕНИЕ НАЗВАНИЙ ФИЛЬМОВ И СЕРИАЛОВ (TitleResolver)
    // =========================================================================
    // Никогда не требует обязательного английского названия и не путает поля
    // фильма (title / original_title) и сериала (name / original_name).
    var TitleResolver = {
        extractMediaMeta: function (card, explicitMethod) {
            card = card || {};
            var isSeries = TitleResolver.detectIsSeries(card, explicitMethod);

            // Строго разделяем поля фильма и сериала
            var localizedTitle = '';
            var originalTitle = '';
            var rawDate = '';

            if (isSeries) {
                localizedTitle = $.trim(String(card.name || card.title || ''));
                originalTitle = $.trim(String(card.original_name || card.original_title || ''));
                rawDate = String(card.first_air_date || card.release_date || card.year || '');
            } else {
                localizedTitle = $.trim(String(card.title || card.name || ''));
                originalTitle = $.trim(String(card.original_title || card.original_name || ''));
                rawDate = String(card.release_date || card.first_air_date || card.year || '');
            }

            var yearMatch = rawDate.match(/\d{4}/);
            var year = yearMatch ? yearMatch[0] : '';

            var altTitles = TitleResolver._extractAlternativeTitles(card);
            var englishTitle = TitleResolver._extractEnglishTitle(card, originalTitle, altTitles);

            var meta = {
                id: card.id || '',
                tmdbId: card.id || '',
                imdbId: card.imdb_id || '',
                kinopoiskId: card.kinopoisk_id || card.kp_id || '',
                mediaType: isSeries ? 'series' : 'movie',
                isSeries: isSeries,
                title: localizedTitle || originalTitle || englishTitle || '',
                localizedTitle: localizedTitle,
                originalTitle: originalTitle,
                englishTitle: englishTitle,
                alternativeTitles: altTitles,
                year: year,
                numberOfSeasons: card.number_of_seasons || (card.seasons && card.seasons.length ? card.seasons.length : 0),
                numberOfEpisodes: card.number_of_episodes || 0,
                originalLanguage: String(card.original_language || '').toLowerCase(),
                rawCard: card
            };

            meta.queryVariants = TitleResolver.buildQueryVariants(meta);
            return meta;
        },

        detectIsSeries: function (card, explicitMethod) {
            if (explicitMethod === 'tv' || explicitMethod === 'series') return true;
            if (explicitMethod === 'movie') return false;
            if (card.first_air_date || card.number_of_seasons || card.original_name) return true;
            if (card.media_type === 'tv') return true;
            if (card.name && !card.title) return true;
            return false;
        },

        _extractAlternativeTitles: function (card) {
            var out = [];
            var seen = {};
            function add(val) {
                var clean = $.trim(String(val || ''));
                if (!clean) return;
                var low = clean.toLowerCase();
                if (!seen[low]) {
                    seen[low] = true;
                    out.push(clean);
                }
            }

            var alt = card.alternative_titles;
            var list = null;
            if (alt) {
                if (Object.prototype.toString.call(alt) === '[object Array]') list = alt;
                else if (Object.prototype.toString.call(alt.titles) === '[object Array]') list = alt.titles;
                else if (Object.prototype.toString.call(alt.results) === '[object Array]') list = alt.results;
            }
            if (list) {
                var i;
                for (i = 0; i < list.length; i++) {
                    if (typeof list[i] === 'string') add(list[i]);
                    else if (list[i] && (list[i].title || list[i].name)) add(list[i].title || list[i].name);
                }
            }
            return out;
        },

        _extractEnglishTitle: function (card, originalTitle, altTitles) {
            if (card.english_title) return $.trim(String(card.english_title));
            if (String(card.original_language || '').toLowerCase() === 'en' && originalTitle) {
                return originalTitle;
            }
            var alt = card.alternative_titles;
            var list = alt ? (alt.titles || alt.results || null) : null;
            if (Object.prototype.toString.call(list) === '[object Array]') {
                var i;
                for (i = 0; i < list.length; i++) {
                    var item = list[i];
                    if (item && (item.iso_3166_1 === 'US' || item.iso_3166_1 === 'GB') && (item.title || item.name)) {
                        return $.trim(String(item.title || item.name));
                    }
                }
            }
            // Если оригинальное название состоит из латиницы — используем его как дополнительный вариант
            if (originalTitle && /^[A-Za-z0-9\s:'\-.,!?&+]+$/.test(originalTitle)) {
                return originalTitle;
            }
            return '';
        },

        /**
         * Формирует упорядоченный список уникальных поисковых вариантов:
         * 1. Локализованное название
         * 2. Оригинальное название
         * 3. Английское название (если есть)
         * 4. Альтернативные названия (если есть)
         * 5. Название + год выпуска
         * 6. Название без года выпуска (если год был в скобках)
         */
        buildQueryVariants: function (meta) {
            var variants = [];
            var seen = {};

            function pushVariant(q, label) {
                var clean = $.trim(String(q || '').replace(/\s+/g, ' '));
                if (!clean) return;
                var key = clean.toLowerCase();
                if (seen[key]) return;
                seen[key] = true;
                variants.push({ query: clean, label: label });
            }

            var stripYear = function (s) {
                return $.trim(String(s || '').replace(/\s*\(\d{4}\)\s*$/, '').replace(/\s+\d{4}$/, ''));
            };

            // 1. Локализованное название (основной запрос)
            pushVariant(meta.localizedTitle, 'Локализованное');

            // 2. Оригинальное название
            pushVariant(meta.originalTitle, 'Оригинальное');

            // 3. Английское название (необязательное)
            pushVariant(meta.englishTitle, 'Английское');

            // 4. Альтернативные названия (до 3)
            var i;
            var maxAlt = Math.min(meta.alternativeTitles.length, 3);
            for (i = 0; i < maxAlt; i++) {
                pushVariant(meta.alternativeTitles[i], 'Альтернативное');
            }

            // 5. Название с годом выпуска
            if (meta.year) {
                if (meta.localizedTitle) pushVariant(stripYear(meta.localizedTitle) + ' ' + meta.year, 'Локализованное + год');
                if (meta.originalTitle) pushVariant(stripYear(meta.originalTitle) + ' ' + meta.year, 'Оригинальное + год');
            }

            // 6. Название без года выпуска (если в заголовке был год)
            if (meta.localizedTitle) pushVariant(stripYear(meta.localizedTitle), 'Без года');
            if (meta.originalTitle) pushVariant(stripYear(meta.originalTitle), 'Оригинал без года');

            return variants;
        }
    };

    // =========================================================================
    // 4. ПРОФИЛИ ИЗВЕСТНЫХ ПЛАГИНОВ LAMPA
    // =========================================================================
    var KNOWN_PLUGIN_PROFILES = [
        {
            id: 'lampac',
            name: 'Lampac',
            adapterType: 'lampac_protocol',
            patterns: ['lampac', '/online.js', 'online_prestige', 'lampa.mx', 'smotret24', 'jin.energy'],
            buttonHints: ['online_prestige', 'lampac', 'онлайн', 'online']
        },
        {
            id: 'bwa',
            name: 'BWA',
            adapterType: 'lampac_protocol',
            patterns: ['bwa.to', '/bwa', 'rc.bwa'],
            buttonHints: ['bwa']
        },
        {
            id: 'online_mod',
            name: 'Online Mod',
            adapterType: 'online_mod',
            patterns: ['online_mod', 'nb557'],
            buttonHints: ['online_mod', 'онлайн мод', 'online mod']
        },
        {
            id: 'alpaca',
            name: 'Alpaca',
            adapterType: 'lampac_or_native',
            patterns: ['alpaca'],
            buttonHints: ['alpaca']
        },
        {
            id: 'gpa',
            name: 'GPA',
            adapterType: 'lampac_or_native',
            patterns: ['gpa'],
            buttonHints: ['gpa']
        },
        {
            id: 'pwa',
            name: 'PWA',
            adapterType: 'lampa_api_or_native',
            patterns: ['pwa', 'pva'],
            buttonHints: ['pwa', 'pva']
        },
        {
            id: 'lumio',
            name: 'Lumio',
            adapterType: 'lampac_or_native',
            patterns: ['lumio'],
            buttonHints: ['lumio']
        },
        {
            id: 'showy',
            name: 'Showy',
            adapterType: 'lampac_or_native',
            patterns: ['showy'],
            buttonHints: ['showy']
        },
        {
            id: 'hdrezka',
            name: 'HDRezka',
            adapterType: 'native_plugin',
            patterns: ['rezka', 'hdrezka'],
            buttonHints: ['rezka', 'резка']
        },
        {
            id: 'kodik',
            name: 'Kodik',
            adapterType: 'native_plugin',
            patterns: ['kodik'],
            buttonHints: ['kodik', 'кодик']
        },
        {
            id: 'kinopub',
            name: 'KinoPub',
            adapterType: 'native_plugin',
            patterns: ['kinopub', 'kpub'],
            buttonHints: ['kinopub', 'кинопаб']
        },
        {
            id: 'filmix',
            name: 'Filmix',
            adapterType: 'native_plugin',
            patterns: ['filmix'],
            buttonHints: ['filmix', 'филмикс']
        },
        {
            id: 'torrents',
            name: 'Торренты (TorrServer)',
            adapterType: 'builtin_torrents',
            patterns: ['torrserver', 'jacred', 'torrent'],
            buttonHints: ['view--torrent', 'торрент', 'torrent']
        }
    ];

    var IGNORED_BUTTON_CLASSES = [
        'andrprod-card-btn',
        'button--book',
        'button--reaction',
        'button--options',
        'button--subscribe',
        'button--trailer',
        'view--trailer'
    ];

    // =========================================================================
    // 5. АДАПТЕРЫ ОБНАРУЖЕНИЯ ИСТОЧНИКОВ (PluginAdapterEngine)
    // =========================================================================
    var PluginAdapterEngine = {
        normalizeSourceRecord: function (plugin, raw) {
            var srcId = makeSafeId(raw.id || raw.balanser || raw.name || 'entry');
            var key = plugin.id + '::' + srcId;

            var q = raw.qualities || {};
            var has4k = typeof q.has4k === 'boolean' ? q.has4k : null;
            var has2160p = typeof q.has2160p === 'boolean' ? q.has2160p : (has4k === true ? true : null);
            var has1080p = typeof q.has1080p === 'boolean' ? q.has1080p : null;
            var has720p = typeof q.has720p === 'boolean' ? q.has720p : null;
            var hasSD = typeof q.hasSD === 'boolean' ? q.hasSD : null;

            var ct = raw.contentTypes || {};
            return {
                key: key,
                id: srcId,
                pluginId: plugin.id,
                pluginName: plugin.name,
                name: raw.name || plugin.name,
                balanser: raw.balanser || '',
                url: raw.url || '',
                isNativeEntryOnly: !!raw.isNativeEntryOnly,
                integrationMode: raw.integrationMode || 'plugin_delegate',
                note: raw.note || '',
                qualities: {
                    has4k: has4k,
                    has2160p: has2160p,
                    has1080p: has1080p,
                    has720p: has720p,
                    hasSD: hasSD
                },
                contentTypes: {
                    movies: typeof ct.movies === 'boolean' ? ct.movies : null,
                    series: typeof ct.series === 'boolean' ? ct.series : null,
                    cartoons: typeof ct.cartoons === 'boolean' ? ct.cartoons : null,
                    anime: typeof ct.anime === 'boolean' ? ct.anime : null
                },
                adapter: raw.adapter || null
            };
        },

        extractOrigin: function (url) {
            if (!url || typeof url !== 'string') return '';
            var m = url.match(/^(https?:\/\/[^\/\?#]+)/i);
            return m ? m[1] : '';
        },

        parseQualityMetadata: function (rawQuality) {
            if (!rawQuality) return {};
            if (typeof rawQuality === 'object') return rawQuality;
            var s = String(rawQuality).toLowerCase();
            if (s.indexOf('2160') !== -1 || s.indexOf('4k') !== -1 || s.indexOf('uhd') !== -1) {
                return { has4k: true, has2160p: true, has1080p: true, has720p: true };
            }
            if (s.indexOf('1080') !== -1 || s.indexOf('fhd') !== -1 || s.indexOf('full hd') !== -1) {
                return { has4k: false, has1080p: true, has720p: true };
            }
            if (s.indexOf('720') !== -1 || s.indexOf('hd') !== -1) {
                return { has4k: false, has1080p: false, has720p: true };
            }
            if (s.indexOf('480') !== -1 || s.indexOf('360') !== -1 || s.indexOf('sd') !== -1) {
                return { has4k: false, has1080p: false, has720p: false, hasSD: true };
            }
            return {};
        },

        parseLampacEventsPayload: function (plugin, payload) {
            var items = [];
            if (!payload) return items;

            var rawList = null;
            if (Object.prototype.toString.call(payload) === '[object Array]') {
                rawList = payload;
            } else if (typeof payload === 'string') {
                try {
                    var parsed = JSON.parse(payload);
                    if (Object.prototype.toString.call(parsed) === '[object Array]') rawList = parsed;
                    else if (parsed && Object.prototype.toString.call(parsed.channels) === '[object Array]') rawList = parsed.channels;
                    else if (parsed && Object.prototype.toString.call(parsed.results) === '[object Array]') rawList = parsed.results;
                } catch (eJson) {
                    return items;
                }
            } else if (typeof payload === 'object') {
                if (Object.prototype.toString.call(payload.channels) === '[object Array]') rawList = payload.channels;
                else if (Object.prototype.toString.call(payload.results) === '[object Array]') rawList = payload.results;
            }

            if (!rawList || !rawList.length) return items;

            var i, entry, title, balanser, url;
            for (i = 0; i < rawList.length; i++) {
                entry = rawList[i];
                if (!entry || typeof entry !== 'object' || entry.show === false) continue;

                title = entry.name || entry.title || entry.balanser || '';
                balanser = entry.balanser || entry.id || '';
                url = entry.url || '';
                if (!title) continue;

                items.push(PluginAdapterEngine.normalizeSourceRecord(plugin, {
                    id: balanser || title,
                    name: title,
                    balanser: balanser,
                    url: url,
                    isNativeEntryOnly: false,
                    integrationMode: 'lampac_events',
                    note: 'Получен с сервера плагина (/lite/events)',
                    qualities: PluginAdapterEngine.parseQualityMetadata(entry.qualities || entry.max_quality || entry.quality),
                    contentTypes: entry.contentTypes || {}
                }));
            }
            return items;
        },

        discoverForPlugin: function (plugin, callback) {
            var self = this;

            if (plugin.customAdapter) {
                var ad = plugin.customAdapter;
                if (typeof ad.getSources === 'function') {
                    var doneAd = false;
                    var timerAd = setTimeout(function () {
                        if (doneAd) return;
                        doneAd = true;
                        callback([]);
                    }, StorageManager.getTimeout());

                    try {
                        ad.getSources(function (list) {
                            if (doneAd) return;
                            doneAd = true;
                            clearTimeout(timerAd);
                            var out = [];
                            if (Object.prototype.toString.call(list) === '[object Array]') {
                                var i;
                                for (i = 0; i < list.length; i++) {
                                    var item = cloneObj(list[i]);
                                    item.adapter = ad;
                                    item.integrationMode = 'direct_adapter';
                                    out.push(self.normalizeSourceRecord(plugin, item));
                                }
                            }
                            callback(out);
                        });
                    } catch (eAd) {
                        if (!doneAd) {
                            doneAd = true;
                            clearTimeout(timerAd);
                            callback([]);
                        }
                    }
                    return;
                }

                callback([
                    self.normalizeSourceRecord(plugin, {
                        id: ad.id,
                        name: ad.name || plugin.name,
                        url: ad.url || plugin.url || '',
                        isNativeEntryOnly: false,
                        integrationMode: 'direct_adapter',
                        note: ad.description || 'Подключён прямой API-адаптер',
                        qualities: ad.qualities || {},
                        contentTypes: ad.contentTypes || {},
                        adapter: ad
                    })
                ]);
                return;
            }

            if (plugin.adapterType === 'lampa_api_or_native') {
                var apiSources = self._inspectLampaApiSources(plugin);
                if (apiSources.length) {
                    callback(apiSources);
                    return;
                }
            }

            var origin = self.extractOrigin(plugin.url);
            if (origin && (plugin.adapterType === 'lampac_protocol' || plugin.adapterType === 'lampac_or_native')) {
                self._probeLampacEvents(plugin, origin, function (serverSources) {
                    if (serverSources && serverSources.length) callback(serverSources);
                    else callback(self._buildHonestNativeFallback(plugin));
                });
                return;
            }

            if (plugin.adapterType === 'online_mod') {
                callback(self._buildOnlineModSources(plugin));
                return;
            }

            callback(self._buildHonestNativeFallback(plugin));
        },

        _probeLampacEvents: function (plugin, origin, callback) {
            var self = this;
            var net = null;
            try {
                net = new Lampa.Reguest();
                net.timeout(StorageManager.getTimeout());
            } catch (e) {
                callback([]);
                return;
            }

            var endpoint = origin + '/lite/events?life=true';
            var done = false;
            var guard = setTimeout(function () {
                if (done) return;
                done = true;
                try { net.clear(); } catch (eC) {}
                callback([]);
            }, StorageManager.getTimeout() + 250);

            net.silent(
                endpoint,
                function (resp) {
                    if (done) return;
                    done = true;
                    clearTimeout(guard);
                    callback(self.parseLampacEventsPayload(plugin, resp));
                },
                function () {
                    if (done) return;
                    done = true;
                    clearTimeout(guard);
                    callback([]);
                },
                false,
                { dataType: 'text' }
            );
        },

        _inspectLampaApiSources: function (plugin) {
            var out = [];
            try {
                if (!Lampa.Api || !Lampa.Api.sources) return out;
                var builtin = { tmdb: true, cub: true, wiki: true };
                var key;
                for (key in Lampa.Api.sources) {
                    if (!Lampa.Api.sources.hasOwnProperty(key) || builtin[key]) continue;
                    var srcObj = Lampa.Api.sources[key];
                    out.push(PluginAdapterEngine.normalizeSourceRecord(plugin, {
                        id: key,
                        name: (srcObj && srcObj.name) ? srcObj.name : key.toUpperCase(),
                        url: plugin.url || '',
                        isNativeEntryOnly: false,
                        integrationMode: 'lampa_api_source',
                        note: 'Обнаружен в Lampa.Api.sources',
                        qualities: {},
                        contentTypes: {}
                    }));
                }
            } catch (e) {}
            return out;
        },

        _buildOnlineModSources: function (plugin) {
            var activeBalanser = '';
            try { activeBalanser = String(Lampa.Storage.get('online_mod_balanser', '') || ''); } catch (e) {}
            return [
                PluginAdapterEngine.normalizeSourceRecord(plugin, {
                    id: activeBalanser || 'native_entry',
                    name: activeBalanser ? ('Online Mod (' + activeBalanser + ')') : 'Online Mod (оригинальный интерфейс)',
                    balanser: activeBalanser,
                    url: plugin.url || '',
                    isNativeEntryOnly: true,
                    integrationMode: 'plugin_delegate',
                    note: 'Программный поиск не поддерживается — запуск через оригинальный интерфейс Online Mod.',
                    qualities: {},
                    contentTypes: {}
                })
            ];
        },

        _buildHonestNativeFallback: function (plugin) {
            return [
                PluginAdapterEngine.normalizeSourceRecord(plugin, {
                    id: 'native_entry',
                    name: plugin.name + ' (оригинальный интерфейс)',
                    url: plugin.url || '',
                    isNativeEntryOnly: true,
                    integrationMode: 'plugin_delegate',
                    note: 'Плагин не предоставляет API программного поиска — доступен запуск через оригинальную кнопку.',
                    qualities: {},
                    contentTypes: {}
                })
            ];
        }
    };

    // =========================================================================
    // 6. РЕЕСТР ПЛАГИНОВ И ИСТОЧНИКОВ (SourceRegistry)
    // =========================================================================
    var SourceRegistry = {
        plugins: {},
        sources: {},
        customAdapters: {},
        healthCache: {},

        resetAndScan: function () {
            var self = this;
            var discoveredPlugins = {};

            var adId;
            for (adId in self.customAdapters) {
                if (!self.customAdapters.hasOwnProperty(adId)) continue;
                var ad = self.customAdapters[adId];
                discoveredPlugins[ad.id] = {
                    id: ad.id,
                    name: ad.name || ad.id,
                    url: ad.url || '',
                    nativeIcon: ad.icon || '',
                    adapterType: 'custom_adapter',
                    buttonHints: ad.buttonHints || [ad.id],
                    detectedVia: 'API-адаптер',
                    customAdapter: ad
                };
            }

            var rawPlugins = [];
            try {
                var stored = Lampa.Storage.get('plugins', []);
                if (Object.prototype.toString.call(stored) === '[object Array]') rawPlugins = rawPlugins.concat(stored);
            } catch (e1) {}
            try {
                if (Lampa.Manifest && Object.prototype.toString.call(Lampa.Manifest.plugins) === '[object Array]') {
                    rawPlugins = rawPlugins.concat(Lampa.Manifest.plugins);
                }
            } catch (e2) {}

            var i, j, k, p, pUrl, pName, pIcon, lowerUrl, lowerName, matchedProfile;
            for (i = 0; i < rawPlugins.length; i++) {
                p = rawPlugins[i];
                if (!p) continue;
                if (typeof p === 'string') {
                    pUrl = p; pName = ''; pIcon = '';
                } else {
                    if (p.status === 0) continue;
                    pUrl = p.url || p.src || '';
                    pName = p.name || p.title || '';
                    pIcon = p.icon || p.picture || p.logo || '';
                }
                if (!pUrl && !pName) continue;

                lowerUrl = String(pUrl).toLowerCase();
                lowerName = String(pName).toLowerCase();
                if (lowerUrl.indexOf('andrprod') !== -1 || lowerName.indexOf('andrprod') !== -1) continue;

                matchedProfile = null;
                for (j = 0; j < KNOWN_PLUGIN_PROFILES.length; j++) {
                    var prof = KNOWN_PLUGIN_PROFILES[j];
                    for (k = 0; k < prof.patterns.length; k++) {
                        if (lowerUrl.indexOf(prof.patterns[k]) !== -1 || lowerName.indexOf(prof.patterns[k]) !== -1) {
                            matchedProfile = prof;
                            break;
                        }
                    }
                    if (matchedProfile) break;
                }

                if (matchedProfile) {
                    if (!discoveredPlugins[matchedProfile.id]) {
                        discoveredPlugins[matchedProfile.id] = {
                            id: matchedProfile.id,
                            name: pName || matchedProfile.name,
                            url: pUrl,
                            nativeIcon: pIcon,
                            adapterType: matchedProfile.adapterType,
                            buttonHints: matchedProfile.buttonHints,
                            detectedVia: 'Установленный плагин'
                        };
                    } else {
                        if (pUrl && !discoveredPlugins[matchedProfile.id].url) discoveredPlugins[matchedProfile.id].url = pUrl;
                        if (pIcon && !discoveredPlugins[matchedProfile.id].nativeIcon) discoveredPlugins[matchedProfile.id].nativeIcon = pIcon;
                    }
                } else {
                    var dynId = makeSafeId(pName || extractPluginLabel(pUrl));
                    if (!discoveredPlugins[dynId]) {
                        discoveredPlugins[dynId] = {
                            id: dynId,
                            name: pName || extractPluginLabel(pUrl),
                            url: pUrl,
                            nativeIcon: pIcon,
                            adapterType: 'lampac_or_native',
                            buttonHints: [dynId, (pName || '').toLowerCase()],
                            detectedVia: 'Установленный плагин'
                        };
                    }
                }
            }

            try {
                if (Lampa.Storage.get('parser_use', false) && !discoveredPlugins['torrents']) {
                    discoveredPlugins['torrents'] = {
                        id: 'torrents',
                        name: 'Торренты (TorrServer)',
                        url: '',
                        nativeIcon: '',
                        adapterType: 'builtin_torrents',
                        buttonHints: ['view--torrent', 'торрент', 'torrent'],
                        detectedVia: 'Встроенный модуль Lampa'
                    };
                }
            } catch (e3) {}

            var oldPid;
            for (oldPid in self.plugins) {
                if (self.plugins.hasOwnProperty(oldPid) && self.plugins[oldPid].detectedVia === 'Кнопка карточки' && !discoveredPlugins[oldPid]) {
                    discoveredPlugins[oldPid] = self.plugins[oldPid];
                }
            }

            self.plugins = discoveredPlugins;

            var pid;
            var newSources = {};
            for (pid in self.plugins) {
                if (!self.plugins.hasOwnProperty(pid)) continue;
                var existing = self.getPluginSources(pid);
                if (existing.length) {
                    for (i = 0; i < existing.length; i++) newSources[existing[i].key] = existing[i];
                } else {
                    var fb = PluginAdapterEngine._buildHonestNativeFallback(self.plugins[pid]);
                    for (i = 0; i < fb.length; i++) newSources[fb[i].key] = fb[i];
                }
            }
            self.sources = newSources;
            return self.getPlugins();
        },

        discoverAllPluginSources: function (onPluginReady, onAllDone) {
            var self = this;
            var pluginList = self.getPlugins();
            var total = pluginList.length;
            if (!total) {
                if (onAllDone) onAllDone();
                return;
            }
            var finished = 0;
            var i;
            for (i = 0; i < total; i++) {
                (function (pl) {
                    PluginAdapterEngine.discoverForPlugin(pl, function (discoveredList) {
                        var key;
                        for (key in self.sources) {
                            if (self.sources.hasOwnProperty(key) && self.sources[key].pluginId === pl.id) {
                                delete self.sources[key];
                            }
                        }
                        var listToStore = (discoveredList && discoveredList.length)
                            ? discoveredList
                            : PluginAdapterEngine._buildHonestNativeFallback(pl);
                        var j;
                        for (j = 0; j < listToStore.length; j++) self.sources[listToStore[j].key] = listToStore[j];

                        finished++;
                        if (onPluginReady) onPluginReady(pl, listToStore);
                        if (finished >= total && onAllDone) onAllDone();
                    });
                })(pluginList[i]);
            }
        },

        registerCardButtonSource: function (btnInfo) {
            if (!btnInfo || !btnInfo.id) return null;
            if (!this.plugins[btnInfo.id]) {
                this.plugins[btnInfo.id] = {
                    id: btnInfo.id,
                    name: btnInfo.name,
                    url: '',
                    nativeIcon: '',
                    adapterType: 'native_plugin',
                    buttonHints: [btnInfo.id, btnInfo.name.toLowerCase()],
                    detectedVia: 'Кнопка карточки'
                };
                var fb = PluginAdapterEngine._buildHonestNativeFallback(this.plugins[btnInfo.id]);
                this.sources[fb[0].key] = fb[0];
            }
            return this.plugins[btnInfo.id];
        },

        registerAdapter: function (adapter) {
            if (!adapter || !adapter.id) return false;
            this.customAdapters[adapter.id] = adapter;
            this.resetAndScan();
            this.discoverAllPluginSources();
            return true;
        },

        getPlugins: function () {
            var list = [];
            var id;
            for (id in this.plugins) {
                if (this.plugins.hasOwnProperty(id)) list.push(this.plugins[id]);
            }
            list.sort(function (a, b) {
                var fa = StorageManager.isPluginFavorite(a.id) ? 1 : 0;
                var fb = StorageManager.isPluginFavorite(b.id) ? 1 : 0;
                if (fa !== fb) return fb - fa;
                return String(a.name).localeCompare(String(b.name));
            });
            return list;
        },

        getPluginById: function (pluginId) {
            return this.plugins[pluginId] || null;
        },

        getPluginSources: function (pluginId) {
            var list = [];
            var key;
            for (key in this.sources) {
                if (this.sources.hasOwnProperty(key) && this.sources[key].pluginId === pluginId) list.push(this.sources[key]);
            }
            return list;
        },

        getAllSources: function () {
            var list = [];
            var key;
            for (key in this.sources) {
                if (this.sources.hasOwnProperty(key)) list.push(this.sources[key]);
            }
            return list;
        },

        getSortedSources: function (options) {
            options = options || {};
            var filters = getDefaultFilters();
            if (options.onlyFavorites) filters.onlyFavorites = true;
            if (options.hideBroken || (options.respectHideBroken && StorageManager.isHideBroken())) filters.hideUnavailable = true;
            var list = this.getAllSources();
            if (options.onlyEnabled) {
                var out = [];
                var i;
                for (i = 0; i < list.length; i++) {
                    if (StorageManager.isEnabled(list[i].key) && StorageManager.isPluginEnabled(list[i].pluginId)) out.push(list[i]);
                }
                list = out;
            }
            return FilterEngine.apply(list, filters);
        },

        getHealth: function (idOrKey) {
            if (this.healthCache[idOrKey]) return this.healthCache[idOrKey];
            if (idOrKey && String(idOrKey).indexOf('::') !== -1) {
                var pid = String(idOrKey).split('::')[0];
                if (this.healthCache[pid]) return this.healthCache[pid];
            }
            var pl = this.plugins[idOrKey];
            if (pl && !pl.url && pl.adapterType !== 'custom_adapter') {
                return { status: 'button_only', latency: 0, checkedAt: 0, message: 'Локальная кнопка плагина' };
            }
            return { status: 'unknown', latency: 0, checkedAt: 0, message: 'Не проверен' };
        }
    };

    // =========================================================================
    // 7. ФИЛЬТРАЦИЯ И СОРТИРОВКА (FilterEngine)
    // =========================================================================
    var FilterEngine = {
        apply: function (sources, filters) {
            filters = filters || StorageManager.getFilters();
            var result = [];
            var qLower = $.trim(String(filters.searchQuery || '')).toLowerCase();
            var i, src, health;

            for (i = 0; i < sources.length; i++) {
                src = sources[i];
                health = SourceRegistry.getHealth(src.key || src.pluginId);

                if (!filters.includeHidden && src.key && !StorageManager.isEnabled(src.key)) continue;

                if (qLower) {
                    var hay = (String(src.name || src.sourceName || '') + ' ' + String(src.pluginName || '') + ' ' + String(src.voice || '')).toLowerCase();
                    if (hay.indexOf(qLower) === -1) continue;
                }

                if (filters.pluginId && filters.pluginId !== 'all' && src.pluginId !== filters.pluginId) continue;

                if (filters.quality && filters.quality !== 'all') {
                    if (!FilterEngine.matchesQuality(src, filters.quality)) continue;
                }
                if (filters.only4k && (!src.qualities || src.qualities.has4k !== true)) continue;
                if (filters.onlyFullHd && (!src.qualities || src.qualities.has1080p !== true)) continue;

                if (filters.contentType && filters.contentType !== 'all') {
                    if (!FilterEngine.matchesContentType(src, filters.contentType)) continue;
                }

                if (filters.onlyWorking) {
                    if (health.status !== 'online' && health.status !== 'button_only' && src.status !== 'found') continue;
                }
                if (filters.hideUnavailable) {
                    if (health.status === 'offline' || health.status === 'unsupported') continue;
                }
                if (filters.onlyFavorites) {
                    if (!StorageManager.isFavorite(src.key) && !StorageManager.isPluginFavorite(src.pluginId)) continue;
                }

                result.push(src);
            }

            return FilterEngine.sort(result, filters.sortBy || 'priority');
        },

        matchesQuality: function (src, qualityFilter) {
            var q = src.qualities || {};
            if (qualityFilter === '4k') return q.has4k === true;
            if (qualityFilter === '2160p') return q.has2160p === true;
            if (qualityFilter === '1080p') return q.has1080p === true;
            if (qualityFilter === '720p') return q.has720p === true;
            if (qualityFilter === 'sd') return q.hasSD === true;
            if (qualityFilter === 'unknown') {
                return q.has4k !== true && q.has2160p !== true && q.has1080p !== true && q.has720p !== true && q.hasSD !== true;
            }
            return true;
        },

        matchesContentType: function (src, typeFilter) {
            var ct = src.contentTypes || {};
            if (typeFilter === 'movie') return ct.movies === true;
            if (typeFilter === 'series') return ct.series === true;
            if (typeFilter === 'cartoon') return ct.cartoons === true;
            if (typeFilter === 'anime') return ct.anime === true;
            return true;
        },

        getQualityScore: function (src) {
            var q = src.qualities || {};
            if (q.has4k === true || q.has2160p === true) return 400;
            if (q.has1080p === true) return 300;
            if (q.has720p === true) return 200;
            if (q.hasSD === true) return 100;
            return 0;
        },

        getQualityLabel: function (src) {
            var q = src.qualities || {};
            if (q.has4k === true || q.has2160p === true) return '4K / 2160p';
            if (q.has1080p === true) return '1080p / Full HD';
            if (q.has720p === true) return '720p / HD';
            if (q.hasSD === true) return 'SD';
            return 'Неизвестно';
        },

        sort: function (list, sortBy) {
            var priorities = StorageManager.getPriorities();
            var copy = list.slice(0);
            copy.sort(function (a, b) {
                var nameA = String(a.name || a.sourceName || '');
                var nameB = String(b.name || b.sourceName || '');
                if (sortBy === 'name') return nameA.localeCompare(nameB);
                if (sortBy === 'quality') {
                    var qa = FilterEngine.getQualityScore(a);
                    var qb = FilterEngine.getQualityScore(b);
                    if (qa !== qb) return qb - qa;
                    return nameA.localeCompare(nameB);
                }
                if (sortBy === 'speed') {
                    var la = (typeof a.latency === 'number' && a.latency > 0) ? a.latency : (SourceRegistry.getHealth(a.key).latency || 999999);
                    var lb = (typeof b.latency === 'number' && b.latency > 0) ? b.latency : (SourceRegistry.getHealth(b.key).latency || 999999);
                    if (la !== lb) return la - lb;
                    return nameA.localeCompare(nameB);
                }

                var pa = priorities.indexOf(a.key);
                var pb = priorities.indexOf(b.key);
                if (pa !== -1 && pb !== -1) return pa - pb;
                if (pa !== -1) return -1;
                if (pb !== -1) return 1;

                var fa = StorageManager.isFavorite(a.key) ? 1 : 0;
                var fb = StorageManager.isFavorite(b.key) ? 1 : 0;
                if (fa !== fb) return fb - fa;

                var qsa = FilterEngine.getQualityScore(a);
                var qsb = FilterEngine.getQualityScore(b);
                if (qsa !== qsb) return qsb - qsa;

                return nameA.localeCompare(nameB);
            });
            return copy;
        },

        countActiveFilters: function (filters) {
            filters = filters || StorageManager.getFilters();
            var c = 0;
            if (filters.quality !== 'all') c++;
            if (filters.contentType !== 'all') c++;
            if (filters.pluginId !== 'all') c++;
            if (filters.onlyWorking) c++;
            if (filters.onlyFavorites) c++;
            if (filters.only4k) c++;
            if (filters.onlyFullHd) c++;
            if (filters.hideUnavailable) c++;
            if (filters.sortBy !== 'priority') c++;
            if ($.trim(filters.searchQuery || '')) c++;
            return c;
        }
    };

    // =========================================================================
    // 8. ПРОВЕРКА ДОСТУПНОСТИ (HealthChecker)
    // =========================================================================
    var HealthChecker = {
        CACHE_TTL_MS: 120000,

        checkTarget: function (cacheKey, url, adapterCheckFn, force, callback) {
            var self = this;
            var cached = SourceRegistry.healthCache[cacheKey];
            var now = Date.now();
            if (!force && cached && cached.checkedAt && (now - cached.checkedAt) < self.CACHE_TTL_MS) {
                if (callback) callback(cached);
                return;
            }

            if (typeof adapterCheckFn === 'function') {
                var startAd = Date.now();
                var doneAd = false;
                var timerAd = setTimeout(function () {
                    if (doneAd) return;
                    doneAd = true;
                    var resT = { status: 'offline', latency: StorageManager.getTimeout(), checkedAt: Date.now(), message: 'Тайм-аут адаптера' };
                    SourceRegistry.healthCache[cacheKey] = resT;
                    if (callback) callback(resT);
                }, StorageManager.getTimeout());

                try {
                    adapterCheckFn(function (ok, msg) {
                        if (doneAd) return;
                        doneAd = true;
                        clearTimeout(timerAd);
                        var res = { status: ok ? 'online' : 'offline', latency: Date.now() - startAd, checkedAt: Date.now(), message: msg || (ok ? 'Доступен' : 'Не отвечает') };
                        SourceRegistry.healthCache[cacheKey] = res;
                        if (callback) callback(res);
                    });
                } catch (eAd) {
                    if (!doneAd) {
                        doneAd = true;
                        clearTimeout(timerAd);
                        var resErr = { status: 'offline', latency: 0, checkedAt: Date.now(), message: 'Ошибка адаптера' };
                        SourceRegistry.healthCache[cacheKey] = resErr;
                        if (callback) callback(resErr);
                    }
                }
                return;
            }

            if (!url || String(url).indexOf('http') !== 0) {
                var btnRes = { status: 'button_only', latency: 0, checkedAt: Date.now(), message: 'Кнопка плагина' };
                SourceRegistry.healthCache[cacheKey] = btnRes;
                if (callback) callback(btnRes);
                return;
            }

            SourceRegistry.healthCache[cacheKey] = { status: 'checking', latency: 0, checkedAt: 0, message: 'Проверка...' };
            var start = Date.now();
            var done = false;
            var timeoutMs = StorageManager.getTimeout();
            var net = null;

            try {
                net = new Lampa.Reguest();
                net.timeout(timeoutMs);
            } catch (eNet) {
                var fbRes = { status: 'button_only', latency: 0, checkedAt: Date.now(), message: 'Локальная проверка недоступна' };
                SourceRegistry.healthCache[cacheKey] = fbRes;
                if (callback) callback(fbRes);
                return;
            }

            var guard = setTimeout(function () {
                if (done) return;
                done = true;
                try { net.clear(); } catch (eC) {}
                var resT = { status: 'offline', latency: timeoutMs, checkedAt: Date.now(), message: 'Тайм-аут (' + Math.round(timeoutMs / 1000) + ' с)' };
                SourceRegistry.healthCache[cacheKey] = resT;
                if (callback) callback(resT);
            }, timeoutMs + 300);

            net.silent(
                url,
                function () {
                    if (done) return;
                    done = true;
                    clearTimeout(guard);
                    var lat = Date.now() - start;
                    var resOk = { status: 'online', latency: lat, checkedAt: Date.now(), message: 'Доступен (' + lat + ' мс)' };
                    SourceRegistry.healthCache[cacheKey] = resOk;
                    if (callback) callback(resOk);
                },
                function () {
                    if (done) return;
                    done = true;
                    clearTimeout(guard);
                    var resFail = { status: 'offline', latency: Date.now() - start, checkedAt: Date.now(), message: 'Сервер недоступен' };
                    SourceRegistry.healthCache[cacheKey] = resFail;
                    if (callback) callback(resFail);
                },
                false,
                { dataType: 'text' }
            );
        },

        checkPlugin: function (plugin, force, callback) {
            if (!plugin) {
                if (callback) callback({ status: 'unsupported', latency: 0, checkedAt: Date.now(), message: 'Не найден' });
                return;
            }
            var checkFn = (plugin.customAdapter && typeof plugin.customAdapter.check === 'function') ? plugin.customAdapter.check : null;
            HealthChecker.checkTarget(plugin.id, plugin.url, checkFn, force, callback);
        },

        checkSource: function (src, force, callback) {
            if (!src) {
                if (callback) callback({ status: 'unsupported', latency: 0, checkedAt: Date.now(), message: 'Нет данных' });
                return;
            }
            var checkFn = (src.adapter && typeof src.adapter.check === 'function') ? function (cb) { src.adapter.check(cb, src); } : null;
            var targetUrl = src.url || (SourceRegistry.getPluginById(src.pluginId) ? SourceRegistry.getPluginById(src.pluginId).url : '');
            HealthChecker.checkTarget(src.key, targetUrl, checkFn, force, callback);
        },

        checkAll: function (force, onUpdate, onComplete) {
            var plugins = SourceRegistry.getPlugins();
            var total = plugins.length;
            if (!total) {
                if (onComplete) onComplete();
                return;
            }
            var finished = 0;
            var i;
            for (i = 0; i < total; i++) {
                (function (pl) {
                    HealthChecker.checkPlugin(pl, force, function (res) {
                        finished++;
                        if (onUpdate) onUpdate(pl, res);
                        if (finished >= total && onComplete) onComplete();
                    });
                })(plugins[i]);
            }
        }
    };

    // =========================================================================
    // 9. РЕЖИМ «ЛУЧШИЙ ВЫБОР» (BestChoiceEngine)
    // =========================================================================
    // Выбирает лучший результат СТРОГО по реальным данным:
    // 1. Подтверждённая возможность запуска (обязательно).
    // 2. Известное реальное качество видео (если «Неизвестно» — не объявляется лучшим).
    // 3. Соответствие фильму/сериалу (и сезону/серии для сериалов).
    // 4. Качество видео (4K > Full HD > HD > SD).
    // 5. Наличие озвучки.
    // 6. Доступность и приоритет пользователя.
    // 7. Скорость ответа — только как второстепенный фактор.
    var BestChoiceEngine = {
        scoreResult: function (res, mediaMeta) {
            // Обязательные ворота: подтверждённый запуск и реальное качество
            if (!res || !res.canLaunch) return -1;
            var qScore = FilterEngine.getQualityScore(res);
            if (qScore <= 0) return -1;

            var score = 0;
            // 1. Рабочий / найденный статус (+1000)
            score += 1000;

            // 2. Соответствие названию / году / типу контента (+0..300)
            score += BestChoiceEngine._computeMatchScore(res, mediaMeta);

            // 3. Для сериалов — наличие сезона/серии (+120)
            if (mediaMeta && mediaMeta.isSeries) {
                if (res.season && res.episode) score += 120;
                else if (res.season) score += 60;
            }

            // 4. Качество видео (4K=+400, 1080p=+300, 720p=+200, SD=+100)
            score += qScore;

            // 5. Озвучка (+60 за наличие, +25 за дубляж/RU/UA)
            if (res.voice) {
                score += 60;
                var vLow = String(res.voice).toLowerCase();
                if (vLow.indexOf('дубляж') !== -1 || vLow.indexOf('dub') !== -1 || vLow.indexOf('рус') !== -1 || vLow.indexOf('укр') !== -1) {
                    score += 25;
                }
            }

            // 6. Пользовательский приоритет и избранное (+0..80)
            if (StorageManager.isFavorite(res.sourceKey) || StorageManager.isPluginFavorite(res.pluginId)) {
                score += 50;
            }
            var prio = StorageManager.getPriorities();
            var idx = prio.indexOf(res.sourceKey);
            if (idx !== -1) {
                score += Math.max(0, 30 - idx * 3);
            }

            // 7. Скорость ответа — минимальный вес (макс +15), никогда не перевешивает качество!
            if (typeof res.latency === 'number' && res.latency > 0) {
                if (res.latency < 500) score += 15;
                else if (res.latency < 1500) score += 10;
                else if (res.latency < 3000) score += 5;
            }

            return score;
        },

        _computeMatchScore: function (res, mediaMeta) {
            if (!mediaMeta) return 100;
            var pts = 0;
            var matchedTitle = String(res.matchedTitle || '').toLowerCase();
            if (matchedTitle) {
                var loc = String(mediaMeta.localizedTitle || '').toLowerCase();
                var orig = String(mediaMeta.originalTitle || '').toLowerCase();
                if ((loc && matchedTitle === loc) || (orig && matchedTitle === orig)) pts += 200;
                else if ((loc && matchedTitle.indexOf(loc) !== -1) || (orig && matchedTitle.indexOf(orig) !== -1)) pts += 140;
                else pts += 60;
            } else if (res.matchedById) {
                pts += 200;
            } else {
                pts += 100;
            }
            if (mediaMeta.year && res.year && String(res.year) === String(mediaMeta.year)) {
                pts += 80;
            }
            return pts;
        },

        evaluate: function (results, mediaMeta) {
            var scored = [];
            var i;
            for (i = 0; i < results.length; i++) {
                var s = BestChoiceEngine.scoreResult(results[i], mediaMeta);
                if (s > 0) {
                    scored.push({ result: results[i], score: s });
                }
            }

            if (!scored.length) {
                return {
                    mode: 'none',
                    best: null,
                    candidates: [],
                    reason: 'Нет результатов с подтверждённым запуском и известным качеством видео.'
                };
            }

            scored.sort(function (a, b) { return b.score - a.score; });

            var topScore = scored[0].score;
            var tied = [scored[0].result];
            for (i = 1; i < scored.length; i++) {
                if ((topScore - scored[i].score) <= 10) {
                    tied.push(scored[i].result);
                }
            }

            if (tied.length > 1) {
                return {
                    mode: 'tie',
                    best: null,
                    candidates: tied,
                    score: topScore,
                    reason: 'Найдено ' + tied.length + ' равноценных лучших вариантов — выберите подходящий.'
                };
            }

            return {
                mode: 'single',
                best: scored[0].result,
                candidates: [scored[0].result],
                score: topScore,
                reason: 'Выбран по реальному качеству, соответствию и подтверждённому запуску.'
            };
        }
    };

    // =========================================================================
    // 10. ЕДИНЫЙ ПОИСК ПО ВСЕМ ОНЛАЙН-ПЛАГИНАМ (UnifiedSearchEngine)
    // =========================================================================
    var UnifiedSearchEngine = {
        /**
         * Запускает поиск по всем установленным и включённым онлайн-плагинам.
         * Ошибка одного плагина никогда не останавливает остальные.
         */
        searchAll: function (card, explicitMethod, buttonMap, callbacks) {
            callbacks = callbacks || {};
            var mediaMeta = TitleResolver.extractMediaMeta(card, explicitMethod);
            SourceRegistry.resetAndScan();

            var plugins = SourceRegistry.getPlugins();
            var activePlugins = [];
            var i;
            for (i = 0; i < plugins.length; i++) {
                if (StorageManager.isPluginEnabled(plugins[i].id)) activePlugins.push(plugins[i]);
            }

            var state = {
                mediaMeta: mediaMeta,
                pluginStatuses: {}, // pluginId -> { plugin, status, label, count, error, latency }
                results: [],
                completedCount: 0,
                totalPlugins: activePlugins.length
            };

            if (!activePlugins.length) {
                if (callbacks.onComplete) callbacks.onComplete(state);
                return state;
            }

            for (i = 0; i < activePlugins.length; i++) {
                var pl = activePlugins[i];
                state.pluginStatuses[pl.id] = {
                    plugin: pl,
                    status: 'searching',
                    label: 'Поиск выполняется...',
                    count: 0,
                    error: '',
                    latency: 0
                };
            }

            if (callbacks.onStart) callbacks.onStart(state);

            for (i = 0; i < activePlugins.length; i++) {
                (function (plugin) {
                    UnifiedSearchEngine.searchSinglePlugin(plugin, mediaMeta, buttonMap, function (outcome) {
                        state.pluginStatuses[plugin.id] = {
                            plugin: plugin,
                            status: outcome.status,
                            label: outcome.label,
                            count: outcome.results.length,
                            error: outcome.error || '',
                            latency: outcome.latency || 0
                        };

                        if (outcome.results && outcome.results.length) {
                            state.results = UnifiedSearchEngine.mergeAndDeduplicate(state.results, outcome.results);
                        }

                        state.completedCount++;
                        if (callbacks.onPluginUpdate) callbacks.onPluginUpdate(state, plugin);
                        if (state.completedCount >= state.totalPlugins && callbacks.onComplete) {
                            callbacks.onComplete(state);
                        }
                    });
                })(activePlugins[i]);
            }

            return state;
        },

        /**
         * Индивидуальный поиск для одного плагина (также используется кнопкой
         * «Повторить поиск» для отдельного проблемного плагина).
         */
        searchSinglePlugin: function (plugin, mediaMeta, buttonMap, callback) {
            var start = Date.now();
            var finished = false;
            var finish = function (outcome) {
                if (finished) return;
                finished = true;
                outcome.latency = Date.now() - start;
                outcome.results = outcome.results || [];
                callback(outcome);
            };

            // 1. Внешний API-адаптер с собственным методом search()
            if (plugin.customAdapter && typeof plugin.customAdapter.search === 'function') {
                var timerAd = setTimeout(function () {
                    finish({ status: 'unavailable', label: 'Временно недоступен (тайм-аут)', results: [], error: 'Тайм-аут адаптера' });
                }, StorageManager.getTimeout());

                try {
                    plugin.customAdapter.search(mediaMeta, mediaMeta.queryVariants, function (err, rawResults) {
                        clearTimeout(timerAd);
                        if (err) {
                            finish({ status: 'error', label: 'Ошибка запроса', results: [], error: String(err) });
                            return;
                        }
                        var normalized = UnifiedSearchEngine._normalizeAdapterResults(plugin, rawResults, Date.now() - start);
                        finish({
                            status: normalized.length ? 'found' : 'empty',
                            label: normalized.length ? ('Найдено (' + normalized.length + ')') : 'Ничего не найдено',
                            results: normalized
                        });
                    });
                } catch (eAd) {
                    clearTimeout(timerAd);
                    finish({ status: 'error', label: 'Ошибка запроса', results: [], error: String(eAd && eAd.message ? eAd.message : eAd) });
                }
                return;
            }

            // 2. Адаптер Lampac / BWA протокола (реальные HTTP-запросы к балансирам сервера)
            var origin = PluginAdapterEngine.extractOrigin(plugin.url);
            if (origin && (plugin.adapterType === 'lampac_protocol' || plugin.adapterType === 'lampac_or_native')) {
                UnifiedSearchEngine._searchLampacPlugin(plugin, origin, mediaMeta, function (outcome) {
                    finish(outcome);
                });
                return;
            }

            // 3. Адаптер PWA / PVA (Lampa.Api.sources)
            if (plugin.adapterType === 'lampa_api_or_native') {
                UnifiedSearchEngine._searchLampaApiPlugin(plugin, mediaMeta, function (outcome) {
                    finish(outcome);
                });
                return;
            }

            // 4. Закрытые плагины без API программного поиска (честное сообщение об ограничении)
            finish({
                status: 'unsupported',
                label: 'Не поддерживается программный поиск',
                results: [],
                hasNativeButton: !!(buttonMap && buttonMap[plugin.id])
            });
        },

        _searchLampacPlugin: function (plugin, origin, mediaMeta, callback) {
            PluginAdapterEngine._probeLampacEvents(plugin, origin, function (balancers) {
                if (!balancers || !balancers.length) {
                    // Если это lampac_or_native (например, закрытый Alpaca/GPA) и /lite/events не ответил —
                    // честно сообщаем, что программный поиск не поддерживается.
                    if (plugin.adapterType === 'lampac_or_native') {
                        callback({ status: 'unsupported', label: 'Не поддерживается программный поиск', results: [] });
                    } else {
                        callback({ status: 'unavailable', label: 'Временно недоступен', results: [], error: 'Сервер /lite/events не ответил' });
                    }
                    return;
                }

                // Ограничиваем число параллельных балансиров для стабильности WebView ТВ
                var activeBalancers = balancers.slice(0, 6);
                var collected = [];
                var doneCount = 0;
                var hadError = false;
                var i;

                for (i = 0; i < activeBalancers.length; i++) {
                    (function (bal) {
                        UnifiedSearchEngine._queryLampacBalancerSequential(plugin, bal, mediaMeta, 0, function (err, resList) {
                            if (err) hadError = true;
                            if (resList && resList.length) collected = collected.concat(resList);
                            doneCount++;
                            if (doneCount >= activeBalancers.length) {
                                if (collected.length) {
                                    callback({ status: 'found', label: 'Найдено (' + collected.length + ')', results: collected });
                                } else if (hadError) {
                                    callback({ status: 'error', label: 'Ошибка запроса', results: [], error: 'Не удалось получить ответ от балансиров' });
                                } else {
                                    callback({ status: 'empty', label: 'Ничего не найдено', results: [] });
                                }
                            }
                        });
                    })(activeBalancers[i]);
                }
            });
        },

        /**
         * Последовательный перебор вариантов названия для одного балансира Lampac:
         * если первый вариант не дал результатов — пробует следующий.
         */
        _queryLampacBalancerSequential: function (plugin, bal, mediaMeta, variantIdx, callback) {
            var variants = mediaMeta.queryVariants || [];
            if (!bal.url || variantIdx >= Math.min(variants.length, 3)) {
                callback(null, []);
                return;
            }

            var variant = variants[variantIdx];
            var sep = bal.url.indexOf('?') === -1 ? '?' : '&';
            var reqUrl = bal.url + sep +
                'rjson=true' +
                '&title=' + encodeURIComponent(variant.query) +
                (mediaMeta.originalTitle ? '&original_title=' + encodeURIComponent(mediaMeta.originalTitle) : '') +
                (mediaMeta.year ? '&year=' + encodeURIComponent(mediaMeta.year) : '') +
                (mediaMeta.imdbId ? '&imdb_id=' + encodeURIComponent(mediaMeta.imdbId) : '') +
                (mediaMeta.kinopoiskId ? '&kinopoisk_id=' + encodeURIComponent(mediaMeta.kinopoiskId) : '') +
                '&serial=' + (mediaMeta.isSeries ? '1' : '0');

            var net = null;
            try {
                net = new Lampa.Reguest();
                net.timeout(StorageManager.getTimeout());
            } catch (e) {
                callback('Lampa.Reguest недоступен', []);
                return;
            }

            var start = Date.now();
            var done = false;
            var guard = setTimeout(function () {
                if (done) return;
                done = true;
                try { net.clear(); } catch (eC) {}
                callback('Тайм-аут', []);
            }, StorageManager.getTimeout() + 250);

            net.silent(
                reqUrl,
                function (resp) {
                    if (done) return;
                    done = true;
                    clearTimeout(guard);
                    var parsed = UnifiedSearchEngine._parseLampacSearchResponse(plugin, bal, mediaMeta, resp, Date.now() - start);
                    if (parsed.length) {
                        callback(null, parsed);
                    } else {
                        // Пробуем следующий вариант названия последовательно
                        UnifiedSearchEngine._queryLampacBalancerSequential(plugin, bal, mediaMeta, variantIdx + 1, callback);
                    }
                },
                function () {
                    if (done) return;
                    done = true;
                    clearTimeout(guard);
                    callback('Ошибка сети', []);
                },
                false,
                { dataType: 'text' }
            );
        },

        _parseLampacSearchResponse: function (plugin, bal, mediaMeta, rawResp, latency) {
            var out = [];
            if (!rawResp) return out;
            var data = rawResp;
            if (typeof rawResp === 'string') {
                try { data = JSON.parse(rawResp); } catch (e) { return out; }
            }
            var list = Object.prototype.toString.call(data) === '[object Array]'
                ? data
                : (data && Object.prototype.toString.call(data.data) === '[object Array]' ? data.data : null);

            if (!list || !list.length) return out;

            var i, item, streamUrl, qObj, maxQ;
            for (i = 0; i < Math.min(list.length, 6); i++) {
                item = list[i];
                if (!item || typeof item !== 'object') continue;
                streamUrl = item.url || item.file || item.stream || '';
                if (!streamUrl && item.quality && typeof item.quality === 'object') {
                    var qKey;
                    for (qKey in item.quality) {
                        if (item.quality.hasOwnProperty(qKey) && item.quality[qKey]) {
                            streamUrl = item.quality[qKey];
                            maxQ = qKey;
                            break;
                        }
                    }
                }
                qObj = PluginAdapterEngine.parseQualityMetadata(item.maxquality || item.quality_label || maxQ || item.quality);
                if (!qObj.has4k && !qObj.has1080p && !qObj.has720p && !qObj.hasSD) {
                    qObj = cloneObj(bal.qualities || {});
                }

                out.push({
                    id: makeSafeId(plugin.id + '_' + bal.id + '_' + (item.title || i) + '_' + (item.translate || '')),
                    key: bal.key,
                    sourceKey: bal.key,
                    pluginId: plugin.id,
                    pluginName: plugin.name,
                    sourceName: bal.name,
                    name: bal.name,
                    matchedTitle: item.title || item.name || mediaMeta.title,
                    matchedById: !!(mediaMeta.imdbId || mediaMeta.kinopoiskId),
                    year: item.year || mediaMeta.year || '',
                    voice: item.translate || item.voice || '',
                    season: item.season || item.s || '',
                    episode: item.episode || item.e || '',
                    streamUrl: streamUrl,
                    qualityMap: (item.quality && typeof item.quality === 'object') ? item.quality : null,
                    qualities: qObj,
                    contentTypes: { movies: !mediaMeta.isSeries, series: !!mediaMeta.isSeries },
                    status: 'found',
                    canLaunch: !!streamUrl,
                    launchType: streamUrl ? 'direct_stream' : 'plugin_button',
                    latency: latency,
                    adapter: null
                });
            }
            return out;
        },

        _searchLampaApiPlugin: function (plugin, mediaMeta, callback) {
            var apiSources = PluginAdapterEngine._inspectLampaApiSources(plugin);
            if (!apiSources.length) {
                callback({ status: 'unsupported', label: 'Не поддерживается программный поиск', results: [] });
                return;
            }
            // Проверяем, предоставляет ли источник реальный метод search() в Lampa.Api.sources
            var searchable = [];
            var i;
            for (i = 0; i < apiSources.length; i++) {
                var apiObj = Lampa.Api && Lampa.Api.sources ? Lampa.Api.sources[apiSources[i].id] : null;
                if (apiObj && typeof apiObj.search === 'function') {
                    searchable.push({ meta: apiSources[i], api: apiObj });
                }
            }
            if (!searchable.length) {
                callback({ status: 'unsupported', label: 'Не поддерживается программный поиск', results: [] });
                return;
            }

            var results = [];
            var done = 0;
            var query = mediaMeta.queryVariants.length ? mediaMeta.queryVariants[0].query : mediaMeta.title;
            var start = Date.now();

            for (i = 0; i < searchable.length; i++) {
                (function (entry) {
                    try {
                        entry.api.search({ query: query }, function (resp) {
                            var list = resp && resp.results ? resp.results : (Object.prototype.toString.call(resp) === '[object Array]' ? resp : []);
                            var j;
                            for (j = 0; j < Math.min(list.length, 3); j++) {
                                var r = list[j];
                                results.push({
                                    id: makeSafeId(plugin.id + '_' + entry.meta.id + '_' + (r.id || j)),
                                    key: entry.meta.key,
                                    sourceKey: entry.meta.key,
                                    pluginId: plugin.id,
                                    pluginName: plugin.name,
                                    sourceName: entry.meta.name,
                                    name: entry.meta.name,
                                    matchedTitle: r.title || r.name || query,
                                    year: (r.release_date || r.first_air_date || '').slice(0, 4),
                                    voice: r.voice || '',
                                    season: r.season || '',
                                    episode: r.episode || '',
                                    streamUrl: r.url || '',
                                    cardData: r,
                                    qualities: PluginAdapterEngine.parseQualityMetadata(r.qualities || r.quality),
                                    contentTypes: { movies: !mediaMeta.isSeries, series: !!mediaMeta.isSeries },
                                    status: 'found',
                                    canLaunch: true,
                                    launchType: r.url ? 'direct_stream' : 'lampa_card',
                                    latency: Date.now() - start,
                                    adapter: null
                                });
                            }
                            done++;
                            if (done >= searchable.length) {
                                callback({
                                    status: results.length ? 'found' : 'empty',
                                    label: results.length ? ('Найдено (' + results.length + ')') : 'Ничего не найдено',
                                    results: results
                                });
                            }
                        }, function () {
                            done++;
                            if (done >= searchable.length) {
                                callback({
                                    status: results.length ? 'found' : 'error',
                                    label: results.length ? ('Найдено (' + results.length + ')') : 'Ошибка запроса',
                                    results: results
                                });
                            }
                        });
                    } catch (e) {
                        done++;
                        if (done >= searchable.length) {
                            callback({ status: results.length ? 'found' : 'error', label: results.length ? ('Найдено (' + results.length + ')') : 'Ошибка запроса', results: results });
                        }
                    }
                })(searchable[i]);
            }
        },

        _normalizeAdapterResults: function (plugin, rawResults, latency) {
            var out = [];
            if (Object.prototype.toString.call(rawResults) !== '[object Array]') return out;
            var i, r;
            for (i = 0; i < rawResults.length; i++) {
                r = rawResults[i];
                if (!r || typeof r !== 'object') continue;
                var srcId = makeSafeId(r.sourceId || r.sourceName || r.name || ('res_' + i));
                var srcKey = plugin.id + '::' + srcId;
                out.push({
                    id: makeSafeId(srcKey + '_' + (r.voice || '') + '_' + (r.season || '') + '_' + (r.episode || '') + '_' + (r.streamUrl || '')),
                    key: srcKey,
                    sourceKey: srcKey,
                    pluginId: plugin.id,
                    pluginName: plugin.name,
                    sourceName: r.sourceName || r.name || plugin.name,
                    name: r.sourceName || r.name || plugin.name,
                    matchedTitle: r.matchedTitle || r.title || '',
                    matchedById: !!r.matchedById,
                    year: r.year || '',
                    voice: r.voice || '',
                    season: r.season || '',
                    episode: r.episode || '',
                    streamUrl: r.streamUrl || r.url || '',
                    qualityMap: r.qualityMap || null,
                    qualities: PluginAdapterEngine.parseQualityMetadata(r.qualities || r.quality),
                    contentTypes: r.contentTypes || {},
                    status: 'found',
                    canLaunch: typeof r.canLaunch === 'boolean' ? r.canLaunch : !!(r.streamUrl || r.url || (plugin.customAdapter && typeof plugin.customAdapter.open === 'function')),
                    launchType: (r.streamUrl || r.url) ? 'direct_stream' : 'direct_adapter',
                    latency: typeof r.latency === 'number' ? r.latency : latency,
                    adapter: plugin.customAdapter || null,
                    rawResult: r
                });
            }
            return out;
        },

        /**
         * Удаляет дублирующиеся результаты по уникальной сигнатуре источника/потока.
         */
        mergeAndDeduplicate: function (existing, incoming) {
            var map = {};
            var out = [];
            var combined = (existing || []).concat(incoming || []);
            var i, r, sig;
            for (i = 0; i < combined.length; i++) {
                r = combined[i];
                var cleanUrl = $.trim(String(r.streamUrl || ''));
                sig = cleanUrl
                    ? ('url|' + cleanUrl)
                    : [
                        r.pluginId,
                        String(r.sourceName || '').toLowerCase(),
                        FilterEngine.getQualityLabel(r),
                        String(r.voice || '').toLowerCase(),
                        String(r.season || ''),
                        String(r.episode || '')
                    ].join('|');
                if (!map[sig]) {
                    map[sig] = true;
                    out.push(r);
                }
            }
            return out;
        },

        /**
         * Запускает именно выбранный результат через его оригинальный механизм.
         */
        launchResult: function (res, mediaMeta, buttonMap) {
            if (!res) return false;

            // 1. Прямой видеопоток через плеер Lampa
            if (res.launchType === 'direct_stream' && res.streamUrl && Lampa.Player && typeof Lampa.Player.play === 'function') {
                var playTitle = (mediaMeta && mediaMeta.title ? mediaMeta.title : res.matchedTitle || res.sourceName);
                if (res.season && res.episode) playTitle += ' • S' + res.season + 'E' + res.episode;
                Lampa.Player.play({
                    url: res.streamUrl,
                    title: playTitle,
                    quality: res.qualityMap || undefined
                });
                return true;
            }

            // 2. Прямой адаптер плагина (вызывает оригинальный open адаптера с конкретным результатом)
            if (res.adapter && typeof res.adapter.open === 'function') {
                res.adapter.open(mediaMeta ? mediaMeta.rawCard : {}, function () {}, res);
                return true;
            }

            // 3. Карточка источника из Lampa.Api.sources
            if (res.launchType === 'lampa_card' && res.cardData) {
                Lampa.Activity.push({
                    url: '',
                    component: 'full',
                    id: res.cardData.id,
                    method: mediaMeta && mediaMeta.isSeries ? 'tv' : 'movie',
                    card: res.cardData,
                    source: res.sourceKey.split('::')[1] || 'tmdb'
                });
                return true;
            }

            // 4. Оригинальная кнопка плагина в карточке фильма
            var btnRec = buttonMap ? buttonMap[res.pluginId] : null;
            if (btnRec && btnRec.element && btnRec.element.length) {
                Lampa.Noty.show('ANDRPROD → ' + res.pluginName);
                btnRec.element.trigger('hover:enter');
                return true;
            }

            Lampa.Noty.show('ANDRPROD: Не удалось запустить источник «' + res.sourceName + '».');
            return false;
        }
    };

    // =========================================================================
    // 11. ИНТЕГРАЦИЯ С КАРТОЧКОЙ ФИЛЬМА / СЕРИАЛА (CardIntegration)
    // =========================================================================
    // Не трогает глобальный поиск, главную страницу, каталоги и кнопки других плагинов.
    var CardIntegration = {
        lastMovie: null,
        lastMethod: '',
        lastButtonMap: {},

        init: function () {
            Lampa.Listener.follow('full', function (e) {
                if (e.type === 'complite') {
                    try {
                        CardIntegration.attachToCard(e);
                    } catch (err) {}
                }
            });
        },

        attachToCard: function (event) {
            var render = event.object && event.object.activity ? event.object.activity.render() : null;
            if (!render || !render.length) return;

            var buttonsContainer = render.find('.full-start-new__buttons');
            if (!buttonsContainer.length) buttonsContainer = render.find('.full-start__buttons');
            if (!buttonsContainer.length) return;

            buttonsContainer.find('.andrprod-card-btn').remove();

            var movie = (event.data && event.data.movie) ? event.data.movie : (event.object && event.object.card ? event.object.card : {});
            var method = (event.object && event.object.method) ? event.object.method : '';
            CardIntegration.lastMovie = movie;
            CardIntegration.lastMethod = method;

            // Крупная, чёткая, прозрачная кнопка ANDRPROD (без рамки и подложки)
            var btn = $(
                '<div class="full-start__button selector andrprod-card-btn" data-andrprod="1">' +
                    BrandIcons.getLogoSvg('andrprod-card-btn__logo', 'card_' + (movie.id || '0')) +
                '</div>'
            );

            buttonsContainer.prepend(btn);

            setTimeout(function () {
                CardIntegration.collectCardButtons(buttonsContainer);
            }, 350);

            btn.on('hover:enter', function () {
                CardIntegration.collectCardButtons(buttonsContainer);
                Lampa.Activity.push({
                    url: '',
                    title: 'ANDRPROD — Поиск источников',
                    component: SEARCH_COMPONENT,
                    movie: movie,
                    method: method,
                    page: 1
                });
            });
        },

        collectCardButtons: function (buttonsContainer) {
            var found = [];
            var map = {};
            if (!buttonsContainer || !buttonsContainer.length) return found;

            buttonsContainer.find('.full-start__button').each(function () {
                var el = $(this);
                var cls = String(el.attr('class') || '');
                var i;
                for (i = 0; i < IGNORED_BUTTON_CLASSES.length; i++) {
                    if (cls.indexOf(IGNORED_BUTTON_CLASSES[i]) !== -1) return;
                }
                var label = $.trim(el.find('span').text() || el.text() || '');
                if (!label) return;
                var lowerLabel = label.toLowerCase();
                var lowerCls = cls.toLowerCase();
                if (lowerLabel.indexOf('трейлер') !== -1 || lowerLabel.indexOf('trailer') !== -1 || lowerLabel.indexOf('закладк') !== -1 || lowerLabel.indexOf('подпис') !== -1) {
                    return;
                }
                var matchedId = CardIntegration._matchButtonToPluginId(lowerLabel, lowerCls) || makeSafeId(label);
                SourceRegistry.registerCardButtonSource({ id: matchedId, name: label });
                var rec = { id: matchedId, name: label, element: el };
                found.push(rec);
                map[matchedId] = rec;
            });

            CardIntegration.lastButtonMap = map;
            return found;
        },

        _matchButtonToPluginId: function (lowerLabel, lowerCls) {
            var i, j, prof;
            for (i = 0; i < KNOWN_PLUGIN_PROFILES.length; i++) {
                prof = KNOWN_PLUGIN_PROFILES[i];
                for (j = 0; j < prof.buttonHints.length; j++) {
                    var hint = prof.buttonHints[j];
                    if (lowerLabel.indexOf(hint) !== -1 || lowerCls.indexOf(hint) !== -1) return prof.id;
                }
            }
            return null;
        },

        launchSingleSource: function (src, movie, buttonMap, onFail) {
            if (!src) {
                if (onFail) onFail();
                return false;
            }
            if (src.integrationMode === 'direct_adapter' && src.adapter && typeof src.adapter.open === 'function') {
                try {
                    src.adapter.open(movie || CardIntegration.lastMovie || {}, function (ok) { if (!ok && onFail) onFail(); }, src);
                    return true;
                } catch (eAd) {
                    if (onFail) onFail();
                    return false;
                }
            }
            var btnRec = buttonMap ? buttonMap[src.pluginId] : null;
            if (btnRec && btnRec.element && btnRec.element.length) {
                try {
                    Lampa.Noty.show('ANDRPROD → ' + src.pluginName + ' (' + src.name + ')');
                    btnRec.element.trigger('hover:enter');
                    return true;
                } catch (eBtn) {
                    if (onFail) onFail();
                    return false;
                }
            }
            if (onFail) onFail();
            return false;
        }
    };

    // =========================================================================
    // 12. ЭКРАН ЕДИНОГО ПОИСКА ДЛЯ ФИЛЬМА/СЕРИАЛА (AndrprodSearchComponent)
    // =========================================================================
    function AndrprodSearchComponent(object) {
        var movie = (object && object.movie) ? object.movie : (CardIntegration.lastMovie || {});
        var method = (object && object.method) ? object.method : (CardIntegration.lastMethod || '');
        var mediaMeta = TitleResolver.extractMediaMeta(movie, method);
        var buttonMap = CardIntegration.lastButtonMap || {};

        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var html = $('<div class="andrprod-hub andrprod-search-screen"></div>');
        var bodyEl = null;
        var lastFocused = null;
        var searchState = null;
        var isDestroyed = false;

        this.create = function () {
            buildAndRender();
            if (StorageManager.getMode() === 'auto') {
                runUnifiedSearch();
            }
            return this.render();
        };

        function runUnifiedSearch() {
            searchState = UnifiedSearchEngine.searchAll(movie, method, buttonMap, {
                onStart: function () { if (!isDestroyed) renderBody(true); },
                onPluginUpdate: function () { if (!isDestroyed) renderBody(true); },
                onComplete: function () { if (!isDestroyed) renderBody(true); }
            });
        }

        function retrySinglePlugin(plugin) {
            if (!searchState) return;
            searchState.pluginStatuses[plugin.id] = {
                plugin: plugin,
                status: 'searching',
                label: 'Повторный поиск...',
                count: 0,
                error: '',
                latency: 0
            };
            renderBody(true);

            UnifiedSearchEngine.searchSinglePlugin(plugin, mediaMeta, buttonMap, function (outcome) {
                if (isDestroyed) return;
                searchState.pluginStatuses[plugin.id] = {
                    plugin: plugin,
                    status: outcome.status,
                    label: outcome.label,
                    count: outcome.results.length,
                    error: outcome.error || '',
                    latency: outcome.latency || 0
                };
                if (outcome.results && outcome.results.length) {
                    searchState.results = UnifiedSearchEngine.mergeAndDeduplicate(searchState.results, outcome.results);
                }
                renderBody(true);
            });
        }

        function buildAndRender() {
            html.empty();
            var mode = StorageManager.getMode();
            var bestChoice = StorageManager.isBestChoice();
            var variantsText = [];
            var i;
            for (i = 0; i < Math.min(mediaMeta.queryVariants.length, 3); i++) {
                variantsText.push(mediaMeta.queryVariants[i].query);
            }

            var header = $(
                '<div class="andrprod-hub__header">' +
                    '<div class="andrprod-hub__brand">' +
                        BrandIcons.getLogoSvg('andrprod-hub__logo', 'search') +
                        '<div class="andrprod-search-title">' +
                            escapeHtml(mediaMeta.title || 'Выбранный контент') +
                            (mediaMeta.year ? ' (' + escapeHtml(mediaMeta.year) + ')' : '') +
                            ' • ' + (mediaMeta.isSeries ? 'Сериал' : 'Фильм') +
                        '</div>' +
                        '<div class="andrprod-hub__stats">' +
                            'Запросы: ' + escapeHtml(variantsText.join(' / ') || 'По ID') +
                        '</div>' +
                    '</div>' +
                    '<div class="andrprod-hub__toolbar">' +
                        '<div class="andrprod-pill selector andrprod-run-search">Найти источники</div>' +
                        '<div class="andrprod-pill selector andrprod-toggle-mode">Режим: ' + (mode === 'auto' ? 'Авто' : 'Ручной') + '</div>' +
                        '<div class="andrprod-pill selector andrprod-toggle-best">Лучший выбор: ' + (bestChoice ? 'Вкл' : 'Выкл') + '</div>' +
                        '<div class="andrprod-pill selector andrprod-open-hub">Каталог ANDRPROD</div>' +
                    '</div>' +
                '</div>'
            );

            header.find('.andrprod-run-search').on('hover:enter', function () {
                runUnifiedSearch();
            });
            header.find('.andrprod-toggle-mode').on('hover:enter', function () {
                StorageManager.setMode(StorageManager.getMode() === 'auto' ? 'manual' : 'auto');
                buildAndRender();
                if (StorageManager.getMode() === 'auto') runUnifiedSearch();
            });
            header.find('.andrprod-toggle-best').on('hover:enter', function () {
                StorageManager.setBestChoice(!StorageManager.isBestChoice());
                buildAndRender();
            });
            header.find('.andrprod-open-hub').on('hover:enter', function () {
                HubLauncher.open({ view: 'home' });
            });

            bodyEl = $('<div class="andrprod-hub__body"></div>');
            scroll.append(bodyEl);
            html.append(header);
            html.append(scroll.render());

            renderBody(false);
        }

        function renderBody(preserveFocus) {
            if (isDestroyed || !bodyEl) return;
            bodyEl.empty();

            if (!searchState) {
                bodyEl.append(
                    '<div class="andrprod-empty">' +
                        '<div class="andrprod-empty__title">Готово к единому поиску</div>' +
                        '<div class="andrprod-empty__desc">Нажмите «Найти источники» для запуска поиска по всем установленным онлайн-плагинам или включите Авто-режим.</div>' +
                    '</div>'
                );
                Lampa.Controller.collectionSet(html);
                return;
            }

            // 1. Блок «Лучший выбор» (если включён и есть результаты)
            if (StorageManager.isBestChoice() && searchState.results.length) {
                var evalRes = BestChoiceEngine.evaluate(searchState.results, mediaMeta);
                if (evalRes.mode === 'single' && evalRes.best) {
                    bodyEl.append('<div class="andrprod-section-title">★ Лучший выбор ANDRPROD</div>');
                    bodyEl.append(buildResultCard(evalRes.best, true));
                } else if (evalRes.mode === 'tie') {
                    bodyEl.append('<div class="andrprod-section-title">★ Равноценные лучшие варианты (' + evalRes.candidates.length + ')</div>');
                    var t;
                    for (t = 0; t < evalRes.candidates.length; t++) bodyEl.append(buildResultCard(evalRes.candidates[t], true));
                } else {
                    bodyEl.append('<div class="andrprod-info-bar"><span>Лучший выбор: ' + escapeHtml(evalRes.reason) + '</span></div>');
                }
            }

            // 2. Единый список найденных результатов (с учётом активных фильтров)
            var filters = StorageManager.getFilters();
            var filteredResults = FilterEngine.apply(searchState.results, filters);
            bodyEl.append('<div class="andrprod-section-title">Найденные результаты (' + filteredResults.length + ')</div>');

            if (filteredResults.length) {
                var rList = $('<div class="andrprod-source-list"></div>');
                var r;
                for (r = 0; r < filteredResults.length; r++) {
                    rList.append(buildResultCard(filteredResults[r], false));
                }
                bodyEl.append(rList);
            } else {
                bodyEl.append(
                    '<div class="andrprod-empty">' +
                        '<div class="andrprod-empty__title">' +
                            (searchState.completedCount < searchState.totalPlugins ? 'Выполняется поиск по плагинам...' : 'Прямые потоковые результаты не найдены') +
                        '</div>' +
                        '<div class="andrprod-empty__desc">Вы можете открыть любой установленный плагин напрямую из списка статусов ниже.</div>' +
                    '</div>'
                );
            }

            // 3. Статус каждого плагина отдельно + кнопка повтора для проблемных / запуск оригинальной кнопки
            bodyEl.append('<div class="andrprod-section-title">Статус онлайн-плагинов (' + searchState.completedCount + '/' + searchState.totalPlugins + ')</div>');
            var pList = $('<div class="andrprod-source-list"></div>');
            var pid;
            for (pid in searchState.pluginStatuses) {
                if (!searchState.pluginStatuses.hasOwnProperty(pid)) continue;
                (function (st) {
                    var pl = st.plugin;
                    var hasBtn = !!(buttonMap && buttonMap[pl.id]);
                    var canRetry = (st.status === 'error' || st.status === 'unavailable' || st.status === 'empty');

                    var row = $(
                        '<div class="andrprod-source-card selector">' +
                            '<div class="andrprod-source-card__main">' +
                                '<div class="andrprod-source-card__header">' +
                                    '<span class="andrprod-status-dot ' + mapSearchStatusDot(st.status) + '"></span>' +
                                    '<span class="andrprod-source-card__title">' + escapeHtml(pl.name) + '</span>' +
                                    '<span class="andrprod-chip">' + escapeHtml(st.label) + '</span>' +
                                '</div>' +
                                (st.error ? '<div class="andrprod-source-card__sub">Причина: ' + escapeHtml(st.error) + '</div>' : '') +
                            '</div>' +
                            '<div class="andrprod-source-card__right">' +
                                '<span class="andrprod-badge ' + (st.status === 'found' ? 'is-on' : 'is-off') + '">' +
                                    (canRetry ? '↻ Повторить' : (hasBtn ? '▶ Открыть в плагине' : 'Инфо')) +
                                '</span>' +
                            '</div>' +
                        '</div>'
                    );

                    row.on('hover:enter', function () {
                        if (canRetry) {
                            retrySinglePlugin(pl);
                        } else if (hasBtn) {
                            Lampa.Noty.show('ANDRPROD → ' + pl.name);
                            buttonMap[pl.id].element.trigger('hover:enter');
                        } else {
                            HubLauncher.open({ view: 'plugin', pluginId: pl.id });
                        }
                    });
                    row.on('hover:focus', function () {
                        lastFocused = row[0];
                        scroll.update(row, true);
                    });
                    pList.append(row);
                })(searchState.pluginStatuses[pid]);
            }
            bodyEl.append(pList);

            Lampa.Controller.collectionSet(html);
            if (!preserveFocus) {
                var first = html.find('.selector')[0];
                if (first) Lampa.Controller.collectionFocus(first, html);
            }
        }

        function buildResultCard(res, isBestHighlight) {
            var qLabel = FilterEngine.getQualityLabel(res);
            var card = $(
                '<div class="andrprod-source-card selector ' + (isBestHighlight ? 'is-best-choice' : '') + '">' +
                    '<div class="andrprod-source-card__main">' +
                        '<div class="andrprod-source-card__header">' +
                            '<span class="andrprod-plugin-tag">' + escapeHtml(res.pluginName) + '</span>' +
                            '<span class="andrprod-source-card__title">' + escapeHtml(res.sourceName) + '</span>' +
                            (isBestHighlight ? '<span class="andrprod-star">★ Лучший выбор</span>' : '') +
                        '</div>' +
                        '<div class="andrprod-chips-row">' +
                            '<span class="andrprod-chip">Качество: <b>' + escapeHtml(qLabel) + '</b></span>' +
                            (res.voice ? '<span class="andrprod-chip">Озвучка: <b>' + escapeHtml(res.voice) + '</b></span>' : '') +
                            (res.season ? '<span class="andrprod-chip">Сезон: <b>' + escapeHtml(res.season) + '</b></span>' : '') +
                            (res.episode ? '<span class="andrprod-chip">Серия: <b>' + escapeHtml(res.episode) + '</b></span>' : '') +
                            '<span class="andrprod-chip">Статус: <b class="is-yes">Найдено</b></span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="andrprod-source-card__right">' +
                        '<span class="andrprod-badge is-on">▶ Запустить</span>' +
                    '</div>' +
                '</div>'
            );

            card.on('hover:enter', function () {
                UnifiedSearchEngine.launchResult(res, mediaMeta, buttonMap);
            });
            card.on('hover:focus', function () {
                lastFocused = card[0];
                scroll.update(card, true);
            });
            return card;
        }

        this.start = function () {
            Lampa.Controller.add('content', {
                toggle: function () {
                    Lampa.Controller.collectionSet(html);
                    Lampa.Controller.collectionFocus(lastFocused || html.find('.selector')[0] || false, html);
                },
                left: function () {
                    if (Navigator.canmove('left')) Navigator.move('left');
                    else Lampa.Controller.toggle('menu');
                },
                right: function () { Navigator.move('right'); },
                up: function () {
                    if (Navigator.canmove('up')) Navigator.move('up');
                    else Lampa.Controller.toggle('head');
                },
                down: function () { Navigator.move('down'); },
                back: function () { Lampa.Activity.backward(); }
            });
            Lampa.Controller.toggle('content');
        };

        this.pause = function () {};
        this.stop = function () {};
        this.render = function () { return html; };
        this.destroy = function () {
            isDestroyed = true;
            try { scroll.destroy(); } catch (e) {}
            html.remove();
        };
    }

    function mapSearchStatusDot(st) {
        if (st === 'found') return 'is-online';
        if (st === 'searching') return 'is-checking';
        if (st === 'error' || st === 'unavailable') return 'is-offline';
        if (st === 'unsupported') return 'is-ready';
        return 'is-unknown';
    }

    // =========================================================================
    // 13. ЦЕНТР УПРАВЛЕНИЯ ПЛАГИНАМИ И ИСТОЧНИКАМИ (AndrprodHubComponent)
    // =========================================================================
    var HubLauncher = {
        open: function (params) {
            params = params || {};
            Lampa.Activity.push({
                url: '',
                title: 'ANDRPROD',
                component: HUB_COMPONENT,
                view: params.view || 'home',
                pluginId: params.pluginId || '',
                page: 1
            });
        }
    };

    function AndrprodHubComponent(object) {
        var currentView = (object && object.view) ? object.view : 'home';
        var selectedPluginId = (object && object.pluginId) ? object.pluginId : '';
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var html = $('<div class="andrprod-hub"></div>');
        var topbarEl = null;
        var navEl = null;
        var bodyEl = null;
        var lastFocused = null;
        var isDestroyed = false;

        var NAV_TABS = [
            { id: 'home', title: 'Плагины' },
            { id: 'all_sources', title: 'Все источники' },
            { id: 'favorites', title: 'Избранное' },
            { id: 'settings', title: 'Настройки' }
        ];

        this.create = function () {
            SourceRegistry.resetAndScan();
            buildShell();
            renderCurrentView();

            SourceRegistry.discoverAllPluginSources(function () {
                if (!isDestroyed) {
                    updateHeaderStats();
                    if (currentView !== 'settings') renderCurrentView(true);
                }
            });

            if (StorageManager.isAutoSearch()) {
                HealthChecker.checkAll(false, function () {
                    if (!isDestroyed) {
                        updateHeaderStats();
                        if (currentView !== 'settings') renderCurrentView(true);
                    }
                });
            }

            return this.render();
        };

        function buildShell() {
            html.empty();
            topbarEl = $(
                '<div class="andrprod-hub__header">' +
                    '<div class="andrprod-hub__brand">' +
                        BrandIcons.getLogoSvg('andrprod-hub__logo', 'hub') +
                        '<div class="andrprod-hub__stats"></div>' +
                    '</div>' +
                    '<div class="andrprod-hub__toolbar">' +
                        '<div class="andrprod-pill selector andrprod-btn-search">Поиск</div>' +
                        '<div class="andrprod-pill selector andrprod-btn-filters">Фильтры</div>' +
                        '<div class="andrprod-pill selector andrprod-btn-refresh">Обновить</div>' +
                    '</div>' +
                '</div>'
            );

            topbarEl.find('.andrprod-btn-search').on('hover:enter', openSearchInput);
            topbarEl.find('.andrprod-btn-filters').on('hover:enter', openFiltersMenu);
            topbarEl.find('.andrprod-btn-refresh').on('hover:enter', function () {
                Lampa.Noty.show('ANDRPROD: Обновление плагинов и источников...');
                SourceRegistry.resetAndScan();
                SourceRegistry.discoverAllPluginSources(null, function () {
                    HealthChecker.checkAll(true, null, function () {
                        if (!isDestroyed) {
                            updateHeaderStats();
                            renderCurrentView(true);
                            Lampa.Noty.show('ANDRPROD: Каталог обновлён.');
                        }
                    });
                });
            });

            navEl = $('<div class="andrprod-hub__tabs"></div>');
            var i;
            for (i = 0; i < NAV_TABS.length; i++) {
                (function (tab) {
                    var tabBtn = $('<div class="andrprod-tab selector" data-view="' + tab.id + '">' + tab.title + '</div>');
                    tabBtn.on('hover:enter', function () {
                        currentView = tab.id;
                        selectedPluginId = '';
                        updateNavActive();
                        renderCurrentView();
                    });
                    navEl.append(tabBtn);
                })(NAV_TABS[i]);
            }

            bodyEl = $('<div class="andrprod-hub__body"></div>');
            scroll.append(bodyEl);
            html.append(topbarEl);
            html.append(navEl);
            html.append(scroll.render());
            updateNavActive();
            updateHeaderStats();
        }

        function updateNavActive() {
            navEl.find('.andrprod-tab').removeClass('is-active');
            var activeId = currentView === 'plugin' ? 'home' : currentView;
            navEl.find('.andrprod-tab[data-view="' + activeId + '"]').addClass('is-active');
        }

        function updateHeaderStats() {
            var pluginsCount = SourceRegistry.getPlugins().length;
            var sourcesCount = SourceRegistry.getAllSources().length;
            var filters = StorageManager.getFilters();
            var activeFilterCount = FilterEngine.countActiveFilters(filters);

            topbarEl.find('.andrprod-hub__stats').html(
                '<span>Плагинов: <b>' + pluginsCount + '</b></span>' +
                '<span class="andrprod-dot-sep">•</span>' +
                '<span>Источников: <b>' + sourcesCount + '</b></span>' +
                (filters.searchQuery ? '<span class="andrprod-dot-sep">•</span><span class="andrprod-search-tag">Поиск: «' + escapeHtml(filters.searchQuery) + '»</span>' : '')
            );
            topbarEl.find('.andrprod-btn-filters').text(activeFilterCount > 0 ? ('Фильтры (' + activeFilterCount + ')') : 'Фильтры');
        }

        function renderCurrentView(preserveFocus) {
            if (isDestroyed) return;
            updateHeaderStats();
            updateNavActive();
            bodyEl.empty();

            if (currentView === 'home') renderHomePluginsView();
            else if (currentView === 'plugin') renderPluginDetailView(selectedPluginId);
            else if (currentView === 'all_sources') renderAllSourcesCatalog();
            else if (currentView === 'favorites') renderFavoritesView();
            else if (currentView === 'settings') renderSettingsView();

            Lampa.Controller.collectionSet(html);
            if (!preserveFocus) {
                var first = bodyEl.find('.selector')[0] || navEl.find('.andrprod-tab.is-active')[0];
                if (first) Lampa.Controller.collectionFocus(first, html);
            }
        }

        function renderHomePluginsView() {
            var filters = StorageManager.getFilters();
            var plugins = SourceRegistry.getPlugins();
            var qLower = $.trim(String(filters.searchQuery || '')).toLowerCase();
            renderActiveFilterStrip(filters);

            var filteredPlugins = [];
            var i;
            for (i = 0; i < plugins.length; i++) {
                var pl = plugins[i];
                if (filters.pluginId !== 'all' && pl.id !== filters.pluginId) continue;
                var plSources = SourceRegistry.getPluginSources(pl.id);
                var matching = FilterEngine.apply(plSources, filters);
                if (qLower) {
                    if (String(pl.name).toLowerCase().indexOf(qLower) === -1 && !matching.length) continue;
                } else if (FilterEngine.countActiveFilters(filters) > 0 && !matching.length) {
                    continue;
                }
                filteredPlugins.push({ plugin: pl, totalSources: plSources.length });
            }

            if (!filteredPlugins.length) {
                bodyEl.append('<div class="andrprod-empty"><div class="andrprod-empty__title">Подходящие плагины не найдены</div><div class="andrprod-empty__desc">Установите онлайн-плагины в Lampa или сбросьте фильтры.</div></div>');
                return;
            }

            var grid = $('<div class="andrprod-plugin-grid"></div>');
            for (i = 0; i < filteredPlugins.length; i++) {
                (function (item) {
                    var pl = item.plugin;
                    var health = SourceRegistry.getHealth(pl.id);
                    var fav = StorageManager.isPluginFavorite(pl.id);
                    var card = $(
                        '<div class="andrprod-plugin-card selector">' +
                            '<div class="andrprod-plugin-card__top">' +
                                BrandIcons.getPluginIconHtml(pl) +
                                '<div class="andrprod-plugin-card__info">' +
                                    '<div class="andrprod-plugin-card__name">' + escapeHtml(pl.name) + (fav ? ' <span class="andrprod-star">★</span>' : '') + '</div>' +
                                    '<div class="andrprod-plugin-card__count">Источников: <b>' + item.totalSources + '</b></div>' +
                                '</div>' +
                            '</div>' +
                            '<div class="andrprod-plugin-card__bottom">' +
                                '<div class="andrprod-status-line"><span class="andrprod-status-dot ' + getStatusDotClass(health.status) + '"></span><span>' + escapeHtml(getStatusHumanLabel(health)) + '</span></div>' +
                                '<div class="andrprod-open-cta">Открыть →</div>' +
                            '</div>' +
                        '</div>'
                    );
                    card.on('hover:enter', function () { selectedPluginId = pl.id; currentView = 'plugin'; renderCurrentView(); });
                    card.on('hover:focus', function () { lastFocused = card[0]; scroll.update(card, true); });
                    grid.append(card);
                })(filteredPlugins[i]);
            }
            bodyEl.append(grid);
        }

        function renderPluginDetailView(pluginId) {
            var pl = SourceRegistry.getPluginById(pluginId);
            if (!pl) { currentView = 'home'; renderHomePluginsView(); return; }

            var health = SourceRegistry.getHealth(pl.id);
            var isFav = StorageManager.isPluginFavorite(pl.id);
            var filters = StorageManager.getFilters();
            var localFilters = cloneObj(filters);
            localFilters.pluginId = pl.id;
            localFilters.includeHidden = true;

            var allPlSources = SourceRegistry.getPluginSources(pl.id);
            var filteredSources = FilterEngine.apply(allPlSources, localFilters);

            var detailHead = $(
                '<div class="andrprod-detail-head">' +
                    '<div class="andrprod-detail-head__left">' +
                        BrandIcons.getPluginIconHtml(pl) +
                        '<div>' +
                            '<div class="andrprod-detail-head__title">' + escapeHtml(String(pl.name).toUpperCase()) + '</div>' +
                            '<div class="andrprod-detail-head__sub">' +
                                '<span class="andrprod-status-dot ' + getStatusDotClass(health.status) + '"></span> ' +
                                escapeHtml(getStatusHumanLabel(health)) + ' • Источников: ' + allPlSources.length +
                                (health.checkedAt ? ' • Проверка: ' + formatTime(health.checkedAt) : '') +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="andrprod-detail-head__actions">' +
                        '<div class="andrprod-pill selector andrprod-btn-back">← К плагинам</div>' +
                        '<div class="andrprod-pill selector andrprod-btn-pl-fav">' + (isFav ? '★ В избранном' : '☆ В избранное') + '</div>' +
                        '<div class="andrprod-pill selector andrprod-btn-pl-check">Проверить</div>' +
                    '</div>' +
                '</div>'
            );

            detailHead.find('.andrprod-btn-back').on('hover:enter', function () { currentView = 'home'; selectedPluginId = ''; renderCurrentView(); });
            detailHead.find('.andrprod-btn-pl-fav').on('hover:enter', function () { StorageManager.togglePluginFavorite(pl.id); renderCurrentView(); });
            detailHead.find('.andrprod-btn-pl-check').on('hover:enter', function () {
                Lampa.Noty.show('Проверка ' + pl.name + '...');
                PluginAdapterEngine.discoverForPlugin(pl, function (list) {
                    var k;
                    for (k in SourceRegistry.sources) {
                        if (SourceRegistry.sources.hasOwnProperty(k) && SourceRegistry.sources[k].pluginId === pl.id) delete SourceRegistry.sources[k];
                    }
                    var j;
                    for (j = 0; j < list.length; j++) SourceRegistry.sources[list[j].key] = list[j];
                    HealthChecker.checkPlugin(pl, true, function () { if (!isDestroyed) renderCurrentView(); });
                });
            });

            bodyEl.append(detailHead);
            renderActiveFilterStrip(filters);

            if (!filteredSources.length) {
                bodyEl.append('<div class="andrprod-empty"><div class="andrprod-empty__title">Нет источников по текущим фильтрам</div></div>');
                return;
            }

            var listEl = $('<div class="andrprod-source-list"></div>');
            var i;
            for (i = 0; i < filteredSources.length; i++) listEl.append(buildSourceCard(filteredSources[i], false));
            bodyEl.append(listEl);
        }

        function renderAllSourcesCatalog() {
            var filters = StorageManager.getFilters();
            renderActiveFilterStrip(filters);
            var all = SourceRegistry.getAllSources();
            var filtered = FilterEngine.apply(all, filters);
            bodyEl.append('<div class="andrprod-info-bar"><span>Показано источников: <b>' + filtered.length + '</b> из ' + all.length + '</span><span>Сортировка: <b>' + getSortLabel(filters.sortBy) + '</b></span></div>');

            if (!filtered.length) {
                bodyEl.append('<div class="andrprod-empty"><div class="andrprod-empty__title">Источники по фильтрам не найдены</div></div>');
                return;
            }
            var listEl = $('<div class="andrprod-source-list"></div>');
            var i;
            for (i = 0; i < filtered.length; i++) listEl.append(buildSourceCard(filtered[i], true));
            bodyEl.append(listEl);
        }

        function buildSourceCard(src, showPluginBadge) {
            var enabled = StorageManager.isEnabled(src.key);
            var fav = StorageManager.isFavorite(src.key);
            var health = SourceRegistry.getHealth(src.key);
            var qLabel = FilterEngine.getQualityLabel(src);

            var card = $(
                '<div class="andrprod-source-card selector ' + (enabled ? '' : 'is-disabled') + '">' +
                    '<div class="andrprod-source-card__main">' +
                        '<div class="andrprod-source-card__header">' +
                            '<span class="andrprod-status-dot ' + getStatusDotClass(health.status) + '"></span>' +
                            (showPluginBadge ? '<span class="andrprod-plugin-tag">' + escapeHtml(src.pluginName) + '</span>' : '') +
                            '<span class="andrprod-source-card__title">' + escapeHtml(src.name) + (fav ? ' <span class="andrprod-star">★</span>' : '') + '</span>' +
                        '</div>' +
                        '<div class="andrprod-chips-row">' +
                            '<span class="andrprod-chip">Качество: <b>' + escapeHtml(qLabel) + '</b></span>' +
                            '<span class="andrprod-chip">4K: ' + formatTriState(src.qualities.has4k) + '</span>' +
                            '<span class="andrprod-chip">Full HD: ' + formatTriState(src.qualities.has1080p) + '</span>' +
                            '<span class="andrprod-chip">HD: ' + formatTriState(src.qualities.has720p) + '</span>' +
                            '<span class="andrprod-chip">Фильмы: ' + formatTriState(src.contentTypes.movies) + '</span>' +
                            '<span class="andrprod-chip">Сериалы: ' + formatTriState(src.contentTypes.series) + '</span>' +
                        '</div>' +
                        '<div class="andrprod-source-card__sub">' +
                            escapeHtml(getStatusHumanLabel(health)) +
                            ' • Проверка: ' + (health.checkedAt ? formatTime(health.checkedAt) : 'Не выполнялась') +
                            (src.note ? ' • ' + escapeHtml(src.note) : '') +
                        '</div>' +
                    '</div>' +
                    '<div class="andrprod-source-card__right">' +
                        '<span class="andrprod-badge ' + (enabled ? 'is-on' : 'is-off') + '">' + (enabled ? 'Активен' : 'Скрыт') + '</span>' +
                    '</div>' +
                '</div>'
            );

            card.on('hover:enter', function () { openSourceActionMenu(src, showPluginBadge); });
            card.on('hover:focus', function () { lastFocused = card[0]; scroll.update(card, true); });
            return card;
        }

        function openSourceActionMenu(src, allowJumpToPlugin) {
            var enabled = StorageManager.isEnabled(src.key);
            var fav = StorageManager.isFavorite(src.key);
            var items = [{ title: '▶ Запустить источник', action: 'launch' }];
            if (allowJumpToPlugin) items.push({ title: 'Перейти к плагину «' + src.pluginName + '»', action: 'open_plugin' });
            items.push(
                { title: fav ? 'Убрать из избранных' : 'Добавить в избранные ★', action: 'toggle_fav' },
                { title: 'Поднять приоритет ▲', action: 'move_up' },
                { title: 'Понизить приоритет ▼', action: 'move_down' },
                { title: enabled ? 'Скрыть источник' : 'Показать источник', action: 'toggle_enable' },
                { title: 'Проверить доступность сейчас', action: 'ping' }
            );

            Lampa.Select.show({
                title: src.pluginName + ' — ' + src.name,
                items: items,
                onSelect: function (item) {
                    if (item.action === 'launch') {
                        var ok = CardIntegration.launchSingleSource(src, CardIntegration.lastMovie, CardIntegration.lastButtonMap);
                        if (!ok) Lampa.Noty.show('ANDRPROD: Откройте фильм или сериал и нажмите кнопку ANDRPROD.');
                        return;
                    }
                    if (item.action === 'open_plugin') { selectedPluginId = src.pluginId; currentView = 'plugin'; renderCurrentView(); return; }
                    if (item.action === 'toggle_fav') { StorageManager.toggleFavorite(src.key); renderCurrentView(); }
                    else if (item.action === 'move_up') { StorageManager.movePriority(src.key, -1); renderCurrentView(); }
                    else if (item.action === 'move_down') { StorageManager.movePriority(src.key, 1); renderCurrentView(); }
                    else if (item.action === 'toggle_enable') { StorageManager.setEnabled(src.key, !enabled); renderCurrentView(); }
                    else if (item.action === 'ping') {
                        HealthChecker.checkSource(src, true, function (res) {
                            Lampa.Noty.show(src.name + ': ' + (res.message || res.status));
                            if (!isDestroyed) renderCurrentView();
                        });
                    }
                    Lampa.Controller.toggle('content');
                },
                onBack: function () { Lampa.Controller.toggle('content'); }
            });
        }

        function renderFavoritesView() {
            var plugins = SourceRegistry.getPlugins();
            var favPlugins = [];
            var i;
            for (i = 0; i < plugins.length; i++) if (StorageManager.isPluginFavorite(plugins[i].id)) favPlugins.push(plugins[i]);

            var allSources = SourceRegistry.getAllSources();
            var favSources = [];
            for (i = 0; i < allSources.length; i++) if (StorageManager.isFavorite(allSources[i].key)) favSources.push(allSources[i]);

            if (!favPlugins.length && !favSources.length) {
                bodyEl.append('<div class="andrprod-empty"><div class="andrprod-empty__title">В избранном пока пусто</div></div>');
                return;
            }
            if (favPlugins.length) {
                bodyEl.append('<div class="andrprod-section-title">Избранные плагины (' + favPlugins.length + ')</div>');
                var pGrid = $('<div class="andrprod-plugin-grid"></div>');
                for (i = 0; i < favPlugins.length; i++) {
                    (function (pl) {
                        var card = $(
                            '<div class="andrprod-plugin-card selector">' +
                                '<div class="andrprod-plugin-card__top">' + BrandIcons.getPluginIconHtml(pl) +
                                '<div class="andrprod-plugin-card__info"><div class="andrprod-plugin-card__name">' + escapeHtml(pl.name) + ' <span class="andrprod-star">★</span></div></div></div>' +
                                '<div class="andrprod-plugin-card__bottom"><span class="andrprod-open-cta">Открыть →</span></div>' +
                            '</div>'
                        );
                        card.on('hover:enter', function () { selectedPluginId = pl.id; currentView = 'plugin'; renderCurrentView(); });
                        card.on('hover:focus', function () { lastFocused = card[0]; scroll.update(card, true); });
                        pGrid.append(card);
                    })(favPlugins[i]);
                }
                bodyEl.append(pGrid);
            }
            if (favSources.length) {
                bodyEl.append('<div class="andrprod-section-title">Избранные источники (' + favSources.length + ')</div>');
                var sList = $('<div class="andrprod-source-list"></div>');
                for (i = 0; i < favSources.length; i++) sList.append(buildSourceCard(favSources[i], true));
                bodyEl.append(sList);
            }
        }

        function renderActiveFilterStrip(filters) {
            if (!FilterEngine.countActiveFilters(filters)) return;
            var strip = $('<div class="andrprod-filter-strip"></div>');
            var tags = [];
            if (filters.quality !== 'all') tags.push('Качество: ' + getQualityFilterName(filters.quality));
            if (filters.contentType !== 'all') tags.push('Контент: ' + getContentTypeName(filters.contentType));
            if (filters.pluginId !== 'all') {
                var pl = SourceRegistry.getPluginById(filters.pluginId);
                tags.push('Плагин: ' + (pl ? pl.name : filters.pluginId));
            }
            if (filters.onlyWorking) tags.push('Только рабочие');
            if (filters.onlyFavorites) tags.push('Только избранные');
            if (filters.only4k) tags.push('Только 4K');
            if (filters.onlyFullHd) tags.push('Только Full HD');
            if (filters.hideUnavailable) tags.push('Скрыть недоступные');
            if (filters.sortBy !== 'priority') tags.push('Сортировка: ' + getSortLabel(filters.sortBy));
            if (filters.searchQuery) tags.push('Поиск: «' + filters.searchQuery + '»');

            strip.append('<div class="andrprod-filter-strip__tags">' + escapeHtml(tags.join(' • ')) + '</div>');
            var resetBtn = $('<div class="andrprod-pill selector">Сбросить</div>');
            resetBtn.on('hover:enter', function () { StorageManager.resetFilters(); renderCurrentView(); });
            strip.append(resetBtn);
            bodyEl.append(strip);
        }

        function openSearchInput() {
            var cur = StorageManager.getFilters().searchQuery || '';
            if (Lampa.Input && typeof Lampa.Input.edit === 'function') {
                Lampa.Input.edit({ title: 'Поиск по плагинам и источникам', value: cur, free: true, nosave: true }, function (val) {
                    StorageManager.setFilters({ searchQuery: $.trim(String(val || '')) });
                    renderCurrentView();
                    Lampa.Controller.toggle('content');
                });
            }
        }

        function openFiltersMenu() {
            var f = StorageManager.getFilters();
            var pl = f.pluginId !== 'all' ? SourceRegistry.getPluginById(f.pluginId) : null;
            Lampa.Select.show({
                title: 'Фильтры ANDRPROD',
                items: [
                    { title: 'Качество видео', subtitle: getQualityFilterName(f.quality), action: 'quality' },
                    { title: 'Тип контента', subtitle: getContentTypeName(f.contentType), action: 'contentType' },
                    { title: 'Плагин', subtitle: pl ? pl.name : 'Все плагины', action: 'pluginId' },
                    { title: 'Сортировка', subtitle: getSortLabel(f.sortBy), action: 'sortBy' },
                    { title: 'Только рабочие источники', subtitle: f.onlyWorking ? 'Вкл ✓' : 'Выкл', action: 'toggle_working' },
                    { title: 'Только избранные', subtitle: f.onlyFavorites ? 'Вкл ✓' : 'Выкл', action: 'toggle_favs' },
                    { title: 'Только источники с 4K', subtitle: f.only4k ? 'Вкл ✓' : 'Выкл', action: 'toggle_4k' },
                    { title: 'Только источники с Full HD', subtitle: f.onlyFullHd ? 'Вкл ✓' : 'Выкл', action: 'toggle_fhd' },
                    { title: 'Скрыть недоступные', subtitle: f.hideUnavailable ? 'Вкл ✓' : 'Выкл', action: 'toggle_hide' },
                    { title: '↺ Сбросить все фильтры', action: 'reset' }
                ],
                onSelect: function (item) {
                    if (item.action === 'quality') openSubFilter('quality', [
                        { id: 'all', title: 'Любое' }, { id: '4k', title: '4K / UHD' }, { id: '2160p', title: '2160p' },
                        { id: '1080p', title: '1080p / Full HD' }, { id: '720p', title: '720p / HD' }, { id: 'sd', title: 'SD' }, { id: 'unknown', title: 'Неизвестное' }
                    ]);
                    else if (item.action === 'contentType') openSubFilter('contentType', [
                        { id: 'all', title: 'Всё' }, { id: 'movie', title: 'Фильмы' }, { id: 'series', title: 'Сериалы' }, { id: 'cartoon', title: 'Мультфильмы' }, { id: 'anime', title: 'Аниме' }
                    ]);
                    else if (item.action === 'pluginId') {
                        var pls = SourceRegistry.getPlugins();
                        var pOpts = [{ id: 'all', title: 'Все плагины' }];
                        var i;
                        for (i = 0; i < pls.length; i++) pOpts.push({ id: pls[i].id, title: 'Только ' + pls[i].name });
                        openSubFilter('pluginId', pOpts);
                    }
                    else if (item.action === 'sortBy') openSubFilter('sortBy', [
                        { id: 'priority', title: 'По приоритету' }, { id: 'quality', title: 'По качеству' }, { id: 'speed', title: 'По скорости ответа' }, { id: 'name', title: 'По названию' }
                    ]);
                    else if (item.action === 'toggle_working') { StorageManager.setFilters({ onlyWorking: !f.onlyWorking }); renderCurrentView(); openFiltersMenu(); }
                    else if (item.action === 'toggle_favs') { StorageManager.setFilters({ onlyFavorites: !f.onlyFavorites }); renderCurrentView(); openFiltersMenu(); }
                    else if (item.action === 'toggle_4k') { StorageManager.setFilters({ only4k: !f.only4k }); renderCurrentView(); openFiltersMenu(); }
                    else if (item.action === 'toggle_fhd') { StorageManager.setFilters({ onlyFullHd: !f.onlyFullHd }); renderCurrentView(); openFiltersMenu(); }
                    else if (item.action === 'toggle_hide') { StorageManager.setFilters({ hideUnavailable: !f.hideUnavailable }); renderCurrentView(); openFiltersMenu(); }
                    else if (item.action === 'reset') { StorageManager.resetFilters(); renderCurrentView(); Lampa.Controller.toggle('content'); }
                },
                onBack: function () { Lampa.Controller.toggle('content'); }
            });
        }

        function openSubFilter(field, opts) {
            var cur = StorageManager.getFilters()[field];
            var i;
            for (i = 0; i < opts.length; i++) opts[i].selected = opts[i].id === cur;
            Lampa.Select.show({
                title: 'Выбор фильтра',
                items: opts,
                onSelect: function (item) {
                    var patch = {};
                    patch[field] = item.id;
                    StorageManager.setFilters(patch);
                    renderCurrentView();
                    openFiltersMenu();
                },
                onBack: openFiltersMenu
            });
        }

        function renderSettingsView() {
            var list = $('<div class="andrprod-settings-list"></div>');
            var rows = [
                {
                    title: 'Режим единого поиска в карточке',
                    desc: 'Ручной запускается по кнопке «Найти источники»; Автоматический ищет сразу.',
                    value: StorageManager.getMode() === 'auto' ? 'Автоматический' : 'Ручной',
                    onEnter: function () { StorageManager.setMode(StorageManager.getMode() === 'auto' ? 'manual' : 'auto'); renderCurrentView(); }
                },
                {
                    title: 'Режим «Лучший выбор»',
                    desc: 'Выделяет лучший подтверждённый результат по качеству, соответствию и озвучке.',
                    value: StorageManager.isBestChoice() ? 'Включено' : 'Выключено',
                    onEnter: function () { StorageManager.setBestChoice(!StorageManager.isBestChoice()); renderCurrentView(); }
                },
                {
                    title: 'Тайм-аут сетевых запросов',
                    desc: 'Защита от зависания, если один из плагинов не отвечает.',
                    value: Math.round(StorageManager.getTimeout() / 1000) + ' сек',
                    onEnter: function () {
                        var opts = [3000, 6000, 9000, 12000];
                        var idx = opts.indexOf(StorageManager.getTimeout());
                        StorageManager.setTimeoutMs(opts[(idx + 1) % opts.length]);
                        renderCurrentView();
                    }
                },
                {
                    title: 'Сбросить сохранённые фильтры',
                    desc: 'Очистить все фильтры качества, контента и поиска.',
                    value: 'Сбросить',
                    onEnter: function () { StorageManager.resetFilters(); Lampa.Noty.show('ANDRPROD: Фильтры сброшены.'); renderCurrentView(); }
                }
            ];

            var i;
            for (i = 0; i < rows.length; i++) {
                (function (row) {
                    var el = $(
                        '<div class="andrprod-setting-row selector">' +
                            '<div class="andrprod-setting-row__text">' +
                                '<div class="andrprod-setting-row__title">' + escapeHtml(row.title) + '</div>' +
                                '<div class="andrprod-setting-row__desc">' + escapeHtml(row.desc) + '</div>' +
                            '</div>' +
                            '<div class="andrprod-setting-row__val">' + escapeHtml(row.value) + '</div>' +
                        '</div>'
                    );
                    el.on('hover:enter', row.onEnter);
                    el.on('hover:focus', function () { lastFocused = el[0]; scroll.update(el, true); });
                    list.append(el);
                })(rows[i]);
            }
            bodyEl.append(list);
        }

        this.start = function () {
            Lampa.Controller.add('content', {
                toggle: function () {
                    Lampa.Controller.collectionSet(html);
                    Lampa.Controller.collectionFocus(lastFocused || navEl.find('.andrprod-tab.is-active')[0] || false, html);
                },
                left: function () { if (Navigator.canmove('left')) Navigator.move('left'); else Lampa.Controller.toggle('menu'); },
                right: function () { Navigator.move('right'); },
                up: function () { if (Navigator.canmove('up')) Navigator.move('up'); else Lampa.Controller.toggle('head'); },
                down: function () { Navigator.move('down'); },
                back: function () {
                    if (currentView === 'plugin') { currentView = 'home'; selectedPluginId = ''; renderCurrentView(); }
                    else Lampa.Activity.backward();
                }
            });
            Lampa.Controller.toggle('content');
        };

        this.pause = function () {};
        this.stop = function () {};
        this.render = function () { return html; };
        this.destroy = function () {
            isDestroyed = true;
            try { scroll.destroy(); } catch (e) {}
            html.remove();
        };
    }

    // =========================================================================
    // 14. УТИЛИТЫ ФОРМАТИРОВАНИЯ
    // =========================================================================
    function formatTriState(val) {
        if (val === true) return '<b class="is-yes">Да</b>';
        if (val === false) return '<span class="is-no">Нет</span>';
        return '<span class="is-unk">Неизвестно</span>';
    }
    function formatTime(ts) {
        try {
            var d = new Date(ts);
            return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
        } catch (e) { return ''; }
    }
    function getStatusDotClass(st) {
        if (st === 'online') return 'is-online';
        if (st === 'button_only') return 'is-ready';
        if (st === 'offline') return 'is-offline';
        if (st === 'checking') return 'is-checking';
        return 'is-unknown';
    }
    function getStatusHumanLabel(h) {
        if (!h) return 'Неизвестно';
        if (h.status === 'online') return 'Доступен' + (h.latency ? ' (' + h.latency + ' мс)' : '');
        if (h.status === 'button_only') return 'Готов (через кнопку плагина)';
        if (h.status === 'offline') return h.message || 'Недоступен';
        if (h.status === 'checking') return 'Проверка...';
        return 'Не проверен';
    }
    function getQualityFilterName(id) {
        var map = { all: 'Любое', '4k': '4K / UHD', '2160p': '2160p', '1080p': '1080p / Full HD', '720p': '720p / HD', sd: 'SD', unknown: 'Неизвестное' };
        return map[id] || id;
    }
    function getContentTypeName(id) {
        var map = { all: 'Всё', movie: 'Фильмы', series: 'Сериалы', cartoon: 'Мультфильмы', anime: 'Аниме' };
        return map[id] || id;
    }
    function getSortLabel(id) {
        var map = { priority: 'По приоритету', quality: 'По качеству', speed: 'По скорости ответа', name: 'По названию' };
        return map[id] || id;
    }
    function makeSafeId(str) {
        return String(str || 'src').toLowerCase().replace(/^https?:\/\//, '').replace(/[^a-z0-9а-яё]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 36) || 'src_custom';
    }
    function extractPluginLabel(url) {
        try {
            var clean = String(url).split('?')[0].split('#')[0];
            var parts = clean.split('/');
            var file = (parts[parts.length - 1] || parts[parts.length - 2] || 'Plugin').replace(/\.js$/i, '').replace(/[_-]+/g, ' ');
            return file ? (file.charAt(0).toUpperCase() + file.slice(1)) : 'Плагин';
        } catch (e) { return 'Плагин'; }
    }
    function cloneObj(obj) {
        var out = {};
        var k;
        for (k in obj) if (obj.hasOwnProperty(k)) out[k] = obj[k];
        return out;
    }
    function escapeHtml(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // =========================================================================
    // 15. БОКОВОЕ МЕНЮ, НАСТРОЙКИ И СТИЛИ (КРУПНЫЙ ТВ-ЛОГОТИП В КАРТОЧКЕ)
    // =========================================================================
    function addSidebarMenuItem() {
        try {
            var menuList = $('.menu .menu__list').eq(0);
            if (!menuList.length || menuList.find('.andrprod-menu-item').length) return;
            var item = $(
                '<li class="menu__item selector andrprod-menu-item">' +
                    '<div class="menu__ico">' + BrandIcons.getMiniIconSvg() + '</div>' +
                    '<div class="menu__text andrprod-menu-text">' + BrandIcons.getLogoSvg('andrprod-menu-logo', 'menu') + '</div>' +
                '</li>'
            );
            item.on('hover:enter', function () { HubLauncher.open({ view: 'home' }); });
            menuList.append(item);
        } catch (e) {}
    }

    var SettingsIntegration = {
        init: function () {
            if (!Lampa.SettingsApi) return;
            try {
                Lampa.SettingsApi.addComponent({ component: PLUGIN_ID, name: 'ANDRPROD', icon: BrandIcons.getMiniIconSvg() });
                Lampa.SettingsApi.addParam({
                    component: PLUGIN_ID,
                    param: { name: STORAGE_KEYS.mode, type: 'select', values: { manual: 'Ручной поиск', auto: 'Автоматический поиск' }, 'default': 'manual' },
                    field: { name: 'Режим единого поиска', description: 'Запуск поиска вручную или автоматически при открытии ANDRPROD' }
                });
                Lampa.SettingsApi.addParam({
                    component: PLUGIN_ID,
                    param: { name: STORAGE_KEYS.bestChoice, type: 'trigger', 'default': false },
                    field: { name: 'Режим «Лучший выбор»', description: 'Подбор лучшего источника по реальному качеству, озвучке и соответствию' }
                });
                Lampa.SettingsApi.addParam({
                    component: PLUGIN_ID,
                    param: { name: STORAGE_KEYS.timeout, type: 'select', values: { '3000': '3 сек', '6000': '6 сек', '9000': '9 сек', '12000': '12 сек' }, 'default': '6000' },
                    field: { name: 'Тайм-аут поиска по плагину', description: 'Изоляция медленных или недоступных плагинов' }
                });
                Lampa.SettingsApi.addParam({
                    component: PLUGIN_ID,
                    param: { name: 'andrprod_open_hub', type: 'button' },
                    field: { name: 'Открыть каталог ANDRPROD', description: 'Плагины, источники, фильтры и приоритеты' },
                    onChange: function () { HubLauncher.open({ view: 'home' }); }
                });
            } catch (e) {}
        }
    };

    function injectStyles() {
        if ($('#andrprod-styles').length) return;
        var css = '' +
            /* УВЕЛИЧЕННАЯ, ЧЁТКАЯ КНОПКА ANDRPROD В КАРТОЧКЕ ФИЛЬМА/СЕРИАЛА (без фона/рамки, не меняет остальные кнопки Lampa) */
            '.andrprod-card-btn{' +
                'background:transparent!important;border:none!important;box-shadow:none!important;' +
                'min-width:14.2em!important;height:3.6em!important;padding:0.55em 1.25em!important;' +
                'display:inline-flex!important;align-items:center;justify-content:center;overflow:visible!important;' +
                'transition:transform .18s ease,filter .18s ease;' +
            '}' +
            '.andrprod-card-btn.focus,.andrprod-card-btn:hover{' +
                'background:transparent!important;box-shadow:none!important;' +
                'transform:scale(1.07);filter:drop-shadow(0 0 16px rgba(56,189,248,.92));' +
            '}' +
            '.andrprod-card-btn__logo{height:2.5em!important;width:auto!important;max-width:none!important;display:block;overflow:visible;}' +
            '.andrprod-menu-logo{height:1.3em;width:auto;display:block;background:transparent;}' +
            '.andrprod-menu-text{display:flex;align-items:center;}' +

            '.andrprod-hub{padding:1.3em 2em 2em 2em;color:#E2E8F0;}' +
            '.andrprod-hub__header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1em;margin-bottom:1.1em;}' +
            '.andrprod-hub__logo{height:2.4em;width:auto;display:block;}' +
            '.andrprod-search-title{font-size:1.15em;font-weight:700;color:#F8FAFC;margin-top:0.3em;}' +
            '.andrprod-hub__stats{font-size:0.88em;color:rgba(226,232,240,.72);margin-top:0.25em;display:flex;align-items:center;flex-wrap:wrap;gap:0.45em;}' +
            '.andrprod-dot-sep{opacity:.4;}' +
            '.andrprod-search-tag{color:#38BDF8;font-weight:600;}' +
            '.andrprod-hub__toolbar{display:flex;align-items:center;gap:0.6em;flex-wrap:wrap;}' +

            '.andrprod-pill{padding:0.55em 1.15em;border-radius:999px;background:rgba(255,255,255,.08);color:#F1F5F9;font-size:0.9em;font-weight:500;transition:background .15s ease,transform .15s ease;}' +
            '.andrprod-pill.focus{background:#0EA5E9;color:#FFFFFF;transform:scale(1.04);box-shadow:0 0 0 2px #7DD3FC;}' +

            '.andrprod-hub__tabs{display:flex;flex-wrap:wrap;gap:0.6em;margin-bottom:1.25em;}' +
            '.andrprod-tab{padding:0.6em 1.2em;border-radius:0.75em;background:rgba(255,255,255,.06);color:rgba(255,255,255,.78);font-size:0.95em;font-weight:500;transition:background .15s ease,transform .15s ease;}' +
            '.andrprod-tab.is-active{background:rgba(14,165,233,.24);color:#7DD3FC;}' +
            '.andrprod-tab.focus{background:#0EA5E9;color:#FFFFFF;transform:scale(1.04);}' +

            '.andrprod-filter-strip{display:flex;align-items:center;justify-content:space-between;gap:1em;padding:0.7em 1em;margin-bottom:1em;border-radius:0.8em;background:rgba(14,165,233,.12);border:1px solid rgba(56,189,248,.28);}' +
            '.andrprod-filter-strip__tags{font-size:0.86em;color:#BAE6FD;}' +

            '.andrprod-plugin-grid{display:flex;flex-wrap:wrap;gap:1em;margin-bottom:1.4em;}' +
            '.andrprod-plugin-card{width:19.5em;padding:1.1em 1.2em;border-radius:1em;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.07);display:flex;flex-direction:column;justify-content:space-between;gap:0.95em;transition:transform .16s ease,background .16s ease,box-shadow .16s ease;}' +
            '.andrprod-plugin-card.focus{transform:scale(1.03);background:rgba(14,165,233,.2);box-shadow:0 0 0 2px #38BDF8;}' +
            '.andrprod-plugin-card__top{display:flex;align-items:center;gap:0.9em;}' +
            '.andrprod-plugin-icon{width:3.1em;height:3.1em;border-radius:0.8em;border:1px solid rgba(56,189,248,.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;}' +
            '.andrprod-plugin-icon svg,.andrprod-plugin-icon img{width:100%;height:100%;object-fit:contain;display:block;}' +
            '.andrprod-plugin-card__name{font-size:1.08em;font-weight:700;color:#F8FAFC;}' +
            '.andrprod-plugin-card__count{font-size:0.84em;color:rgba(226,232,240,.68);margin-top:0.2em;}' +
            '.andrprod-plugin-card__bottom{display:flex;align-items:center;justify-content:space-between;font-size:0.84em;padding-top:0.65em;border-top:1px solid rgba(255,255,255,.07);}' +
            '.andrprod-status-line{display:flex;align-items:center;gap:0.5em;color:rgba(226,232,240,.76);}' +
            '.andrprod-open-cta{color:#38BDF8;font-weight:700;}' +

            '.andrprod-detail-head{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1em;padding:1.1em 1.3em;margin-bottom:1.1em;border-radius:1em;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);}' +
            '.andrprod-detail-head__left{display:flex;align-items:center;gap:1em;}' +
            '.andrprod-detail-head__title{font-size:1.35em;font-weight:800;letter-spacing:1.2px;color:#F8FAFC;}' +
            '.andrprod-detail-head__sub{font-size:0.86em;color:rgba(226,232,240,.7);margin-top:0.25em;display:flex;align-items:center;gap:0.45em;flex-wrap:wrap;}' +
            '.andrprod-detail-head__actions{display:flex;align-items:center;gap:0.6em;flex-wrap:wrap;}' +

            '.andrprod-section-title{font-size:1.05em;font-weight:700;color:#7DD3FC;margin:0.9em 0 0.7em 0;}' +
            '.andrprod-info-bar{display:flex;justify-content:space-between;margin-bottom:0.9em;font-size:0.88em;color:rgba(226,232,240,.72);}' +

            '.andrprod-source-list{display:flex;flex-direction:column;gap:0.7em;}' +
            '.andrprod-source-card{display:flex;align-items:center;justify-content:space-between;gap:1em;padding:1em 1.25em;border-radius:0.9em;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.06);transition:background .15s ease,transform .15s ease,box-shadow .15s ease;}' +
            '.andrprod-source-card.is-best-choice{background:rgba(14,165,233,.16);border-color:rgba(56,189,248,.55);}' +
            '.andrprod-source-card.is-disabled{opacity:.5;}' +
            '.andrprod-source-card.focus{background:rgba(14,165,233,.24);transform:scale(1.01);box-shadow:0 0 0 2px #38BDF8;}' +
            '.andrprod-source-card__header{display:flex;align-items:center;gap:0.6em;flex-wrap:wrap;}' +
            '.andrprod-plugin-tag{padding:0.18em 0.6em;border-radius:0.4em;background:rgba(56,189,248,.18);color:#7DD3FC;font-size:0.78em;font-weight:700;}' +
            '.andrprod-source-card__title{font-size:1.04em;font-weight:700;color:#F8FAFC;}' +
            '.andrprod-chips-row{display:flex;flex-wrap:wrap;gap:0.45em;margin-top:0.5em;}' +
            '.andrprod-chip{padding:0.2em 0.55em;border-radius:0.4em;background:rgba(255,255,255,.06);font-size:0.78em;color:rgba(226,232,240,.84);}' +
            '.andrprod-chip .is-yes{color:#4ADE80;}' +
            '.andrprod-chip .is-no{color:#F87171;}' +
            '.andrprod-chip .is-unk{color:#94A3B8;}' +
            '.andrprod-source-card__sub{font-size:0.81em;color:rgba(226,232,240,.62);margin-top:0.45em;}' +

            '.andrprod-status-dot{width:0.68em;height:0.68em;border-radius:50%;display:inline-block;flex-shrink:0;}' +
            '.andrprod-status-dot.is-online{background:#22C55E;box-shadow:0 0 8px rgba(34,197,94,.7);}' +
            '.andrprod-status-dot.is-ready{background:#38BDF8;box-shadow:0 0 8px rgba(56,189,248,.6);}' +
            '.andrprod-status-dot.is-offline{background:#EF4444;}' +
            '.andrprod-status-dot.is-checking{background:#F59E0B;}' +
            '.andrprod-status-dot.is-unknown{background:#94A3B8;}' +
            '.andrprod-star{color:#FBBF24;font-weight:700;}' +
            '.andrprod-badge{padding:0.3em 0.8em;border-radius:999px;font-size:0.8em;font-weight:700;white-space:nowrap;}' +
            '.andrprod-badge.is-on{background:rgba(34,197,94,.18);color:#4ADE80;}' +
            '.andrprod-badge.is-off{background:rgba(148,163,184,.2);color:#CBD5E1;}' +

            '.andrprod-settings-list{display:flex;flex-direction:column;gap:0.65em;}' +
            '.andrprod-setting-row{display:flex;align-items:center;justify-content:space-between;padding:1em 1.25em;border-radius:0.85em;background:rgba(255,255,255,.05);}' +
            '.andrprod-setting-row.focus{background:rgba(14,165,233,.24);box-shadow:0 0 0 2px #38BDF8;}' +
            '.andrprod-setting-row__title{font-size:1em;font-weight:600;}' +
            '.andrprod-setting-row__desc{font-size:0.82em;color:rgba(226,232,240,.62);margin-top:0.2em;}' +
            '.andrprod-setting-row__val{font-size:0.92em;font-weight:700;color:#38BDF8;margin-left:1.5em;white-space:nowrap;}' +
            '.andrprod-empty{padding:2.2em 1.5em;text-align:center;background:rgba(255,255,255,.04);border-radius:0.9em;}' +
            '.andrprod-empty__title{font-size:1.1em;font-weight:600;margin-bottom:0.45em;}' +
            '.andrprod-empty__desc{font-size:0.9em;color:rgba(226,232,240,.68);max-width:44em;margin:0 auto;}';

        $('head').append('<style id="andrprod-styles">' + css + '</style>');
    }

    // =========================================================================
    // 16. ПУБЛИЧНЫЙ API (window.ANDRPROD_API)
    // =========================================================================
    window.ANDRPROD_API = {
        version: PLUGIN_VERSION,
        registerAdapter: function (adapter) { return SourceRegistry.registerAdapter(adapter); },
        getPlugins: function () { return SourceRegistry.getPlugins(); },
        getPluginSources: function (pluginId) { return SourceRegistry.getPluginSources(pluginId); },
        getSources: function () { return SourceRegistry.getAllSources(); },
        getFilteredSources: function (customFilters) { return FilterEngine.apply(SourceRegistry.getAllSources(), customFilters || StorageManager.getFilters()); },
        getFilters: function () { return StorageManager.getFilters(); },
        setFilters: function (patch) { return StorageManager.setFilters(patch); },
        resolveTitles: function (card, method) { return TitleResolver.extractMediaMeta(card, method); },
        searchMedia: function (card, method, callbacks) { return UnifiedSearchEngine.searchAll(card, method, CardIntegration.lastButtonMap, callbacks); },
        evaluateBestChoice: function (results, mediaMeta) { return BestChoiceEngine.evaluate(results, mediaMeta); },
        launchResult: function (res, mediaMeta) { return UnifiedSearchEngine.launchResult(res, mediaMeta, CardIntegration.lastButtonMap); },
        rescan: function (onDone) { SourceRegistry.resetAndScan(); SourceRegistry.discoverAllPluginSources(null, onDone); return SourceRegistry.getPlugins(); },
        openHub: function (view) { HubLauncher.open({ view: view || 'home' }); },
        openPlugin: function (pluginId) { HubLauncher.open({ view: 'plugin', pluginId: pluginId }); }
    };

    // =========================================================================
    // 17. ИНИЦИАЛИЗАЦИЯ ПЛАГИНА
    // =========================================================================
    function startPlugin() {
        try {
            injectStyles();
            Lampa.Component.add(HUB_COMPONENT, AndrprodHubComponent);
            Lampa.Component.add(SEARCH_COMPONENT, AndrprodSearchComponent);
            SourceRegistry.resetAndScan();
            SourceRegistry.discoverAllPluginSources();
            CardIntegration.init();
            SettingsIntegration.init();
            addSidebarMenuItem();
        } catch (err) {}
    }

    if (window.appready) {
        startPlugin();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') startPlugin();
        });
    }
})();
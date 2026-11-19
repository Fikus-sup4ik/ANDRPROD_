(function () {
    'use strict';

    /**
     * ANDRPROD v2.0 — Единый центр управления онлайн-плагинами и их источниками для Lampa
     * Совместимость: Lampa 1.x / 2.x / 3.x, Android TV, Smart TV (Tizen / webOS), Desktop (ES5)
     *
     * Сохранённые и расширенные модули:
     * 1. BrandIcons        — прозрачный логотип ANDRPROD и система иконок для каждого плагина.
     * 2. StorageManager    — сохранение всех настроек, избранного, приоритетов и фильтров в Lampa.Storage.
     * 3. PluginAdapterEngine — индивидуальные адаптеры для плагинов (Lampac/BWA /lite/events,
     *                          Lampa.Api.sources, адаптеры закрытых плагинов, window.ANDRPROD_API).
     * 4. SourceRegistry    — реальное обнаружение установленных плагинов и их внутренних источников.
     * 5. FilterEngine      — одновременная многокритериальная фильтрация и сортировка по реальным данным.
     * 6. HealthChecker     — проверка доступности плагинов и источников с тайм-аутами и меткой времени.
     * 7. CardIntegration   — прозрачная кнопка ANDRPROD в карточке фильма/сериала, запуск и fallback.
     * 8. HubComponent      — главная страница (карточки плагинов, поиск, счётчики, фильтры),
     *                        страница конкретного плагина, общий каталог «Все источники»,
     *                        разделы «Избранное», «Фильмы», «Сериалы», «Настройки» с пультом ТВ.
     * 9. SettingsIntegration — нативный раздел в Lampa.SettingsApi.
     */

    if (window.andrprod_plugin_loaded) return;
    window.andrprod_plugin_loaded = true;

    var PLUGIN_ID = 'andrprod';
    var PLUGIN_VERSION = '2.0.0';
    var HUB_COMPONENT = 'andrprod_hub';

    // =========================================================================
    // 1. ПРОЗРАЧНЫЙ ЛОГОТИП ANDRPROD И ИКОНКИ ПЛАГИНОВ (BrandIcons)
    // =========================================================================
    var BrandIcons = {
        getLogoSvg: function (className, uid) {
            var gradId = 'andrprod_grad_' + (uid || 'main');
            return (
                '<svg class="andrprod-logo-svg ' + (className || '') + '" viewBox="0 0 260 44" xmlns="http://www.w3.org/2000/svg" aria-label="ANDRPROD" role="img">' +
                    '<defs>' +
                        '<linearGradient id="' + gradId + '" x1="0%" y1="0%" x2="100%" y2="0%">' +
                            '<stop offset="0%" stop-color="#38BDF8"/>' +
                            '<stop offset="50%" stop-color="#0EA5E9"/>' +
                            '<stop offset="100%" stop-color="#2563EB"/>' +
                        '</linearGradient>' +
                    '</defs>' +
                    '<text x="0" y="33" fill="url(#' + gradId + ')" ' +
                        'font-family="\'Segoe UI\', \'Roboto\', \'Helvetica Neue\', Arial, sans-serif" ' +
                        'font-size="34" font-weight="800" letter-spacing="3.2">ANDRPROD</text>' +
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

        /**
         * Возвращает собственную иконку плагина (если она есть в манифесте или адаптере),
         * либо аккуратную векторную монограмму с буквенным обозначением плагина.
         */
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
            var clean = String(name || '').replace(/[^a-zA-Zа-яА-ЯёЁ0-9\s]/g, ' ').replace(/\s+/g, ' ');
            clean = $.trim(clean);
            if (!clean) return 'PL';
            var words = clean.split(' ');
            if (words.length >= 2) {
                return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
            }
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
    // 2. ХРАНИЛИЩЕ НАСТРОЕК И ФИЛЬТРОВ (StorageManager / Config)
    // =========================================================================
    var STORAGE_KEYS = {
        mode: 'andrprod_mode',                     // 'manual' | 'auto'
        autoSearch: 'andrprod_auto_search',        // true | false
        hideBroken: 'andrprod_hide_broken',        // true | false
        timeout: 'andrprod_timeout_ms',            // 3000 | 5000 | 8000 | 12000
        disabled: 'andrprod_disabled_sources',     // { key: true }
        disabledPlugins: 'andrprod_disabled_plugins', // { pluginId: true }
        favorites: 'andrprod_favorite_sources',    // { key: true }
        favoritePlugins: 'andrprod_favorite_plugins', // { pluginId: true }
        priorities: 'andrprod_source_priorities',  // [key1, key2, ...]
        filters: 'andrprod_filters_v2'             // persisted FilterState
    };

    function getDefaultFilters() {
        return {
            quality: 'all',          // 'all' | '4k' | '2160p' | '1080p' | '720p' | 'sd' | 'unknown'
            contentType: 'all',      // 'all' | 'movie' | 'series' | 'cartoon' | 'anime'
            pluginId: 'all',         // 'all' | '<plugin_id>'
            onlyWorking: false,
            onlyFavorites: false,
            only4k: false,
            onlyFullHd: false,
            hideUnavailable: false,
            sortBy: 'priority',      // 'priority' | 'quality' | 'speed' | 'name'
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
            var t = parseInt(StorageManager.get(STORAGE_KEYS.timeout, 5000), 10);
            if (isNaN(t) || t < 2000 || t > 20000) return 5000;
            return t;
        },
        setTimeoutMs: function (ms) {
            StorageManager.set(STORAGE_KEYS.timeout, parseInt(ms, 10) || 5000);
        },
        // --- Источники (enabled / hidden / favorite / priority) ---
        getDisabledMap: function () {
            var m = StorageManager.get(STORAGE_KEYS.disabled, {});
            return m && typeof m === 'object' ? m : {};
        },
        isEnabled: function (sourceKey) {
            var m = StorageManager.getDisabledMap();
            return !m[sourceKey];
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
            var m = StorageManager.getFavoritesMap();
            return !!m[sourceKey];
        },
        toggleFavorite: function (sourceKey) {
            var m = StorageManager.getFavoritesMap();
            if (m[sourceKey]) delete m[sourceKey];
            else m[sourceKey] = true;
            StorageManager.set(STORAGE_KEYS.favorites, m);
            return !!m[sourceKey];
        },
        // --- Плагины (enabled / favorite) ---
        getDisabledPluginsMap: function () {
            var m = StorageManager.get(STORAGE_KEYS.disabledPlugins, {});
            return m && typeof m === 'object' ? m : {};
        },
        isPluginEnabled: function (pluginId) {
            var m = StorageManager.getDisabledPluginsMap();
            return !m[pluginId];
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
            var m = StorageManager.getFavoritePluginsMap();
            return !!m[pluginId];
        },
        togglePluginFavorite: function (pluginId) {
            var m = StorageManager.getFavoritePluginsMap();
            if (m[pluginId]) delete m[pluginId];
            else m[pluginId] = true;
            StorageManager.set(STORAGE_KEYS.favoritePlugins, m);
            return !!m[pluginId];
        },
        // --- Приоритеты источников ---
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
        // --- Фильтры (запоминание между перезапусками) ---
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

    // Псевдоним для обратной совместимости
    var Config = StorageManager;

    // =========================================================================
    // 3. СИГНАТУРЫ ИЗВЕСТНЫХ ПЛАГИНОВ LAMPA И ИХ АДАПТЕРОВ
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
    // 4. ДВИЖОК РЕАЛЬНЫХ АДАПТЕРОВ ПЛАГИНОВ (PluginAdapterEngine)
    // =========================================================================
    // Важно: ни один адаптер не выдумывает источники, качества или статусы.
    // Если плагин возвращает реальный список (через /lite/events, Lampa.Api.sources
    // или зарегистрированный API-адаптер), ANDRPROD раскрывает каждый источник.
    // Если плагин закрыт и не отдаёт внутренний список — отображается честный
    // единый вход в оригинальный интерфейс плагина со статусом качества «Неизвестно».
    var PluginAdapterEngine = {
        /**
         * Нормализует структуру одного источника.
         * Никогда не угадывает качество по названию источника или плагина!
         */
        normalizeSourceRecord: function (plugin, raw) {
            var srcId = makeSafeId(raw.id || raw.balanser || raw.name || 'entry');
            var key = plugin.id + '::' + srcId;

            // Реальные флаги качества: null означает «Неизвестно»
            var q = raw.qualities || {};
            var has4k = typeof q.has4k === 'boolean' ? q.has4k : null;
            var has2160p = typeof q.has2160p === 'boolean' ? q.has2160p : (has4k === true ? true : null);
            var has1080p = typeof q.has1080p === 'boolean' ? q.has1080p : null;
            var has720p = typeof q.has720p === 'boolean' ? q.has720p : null;
            var hasSD = typeof q.hasSD === 'boolean' ? q.hasSD : null;

            // Реальные флаги типов контента: null означает «Неизвестно»
            var ct = raw.contentTypes || {};
            var movies = typeof ct.movies === 'boolean' ? ct.movies : null;
            var series = typeof ct.series === 'boolean' ? ct.series : null;
            var cartoons = typeof ct.cartoons === 'boolean' ? ct.cartoons : null;
            var anime = typeof ct.anime === 'boolean' ? ct.anime : null;

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
                    movies: movies,
                    series: series,
                    cartoons: cartoons,
                    anime: anime
                },
                adapter: raw.adapter || null
            };
        },

        /**
         * Извлекает базовый origin (http(s)://host:port) из URL плагина.
         */
        extractOrigin: function (url) {
            if (!url || typeof url !== 'string') return '';
            var m = url.match(/^(https?:\/\/[^\/\?#]+)/i);
            return m ? m[1] : '';
        },

        /**
         * Парсит реальный ответ Lampac / BWA `/lite/events`.
         * Поддерживает массив балансиров, возвращаемый Lampac-совместимыми серверами.
         */
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

            var i, entry, title, url, balanser;
            for (i = 0; i < rawList.length; i++) {
                entry = rawList[i];
                if (!entry || typeof entry !== 'object') continue;
                if (entry.show === false) continue;

                title = entry.name || entry.title || entry.balanser || '';
                balanser = entry.balanser || entry.id || '';
                url = entry.url || '';
                if (!title) continue;

                // Считываем только те метаданные качества/контента, которые реально вернул сервер
                var qObj = {};
                if (entry.qualities && typeof entry.qualities === 'object') {
                    qObj = entry.qualities;
                } else if (entry.max_quality || entry.quality) {
                    var mq = String(entry.max_quality || entry.quality).toLowerCase();
                    if (mq.indexOf('2160') !== -1 || mq.indexOf('4k') !== -1 || mq.indexOf('uhd') !== -1) {
                        qObj.has4k = true;
                        qObj.has2160p = true;
                        qObj.has1080p = true;
                        qObj.has720p = true;
                    } else if (mq.indexOf('1080') !== -1 || mq.indexOf('fhd') !== -1) {
                        qObj.has4k = false;
                        qObj.has1080p = true;
                        qObj.has720p = true;
                    } else if (mq.indexOf('720') !== -1 || mq.indexOf('hd') !== -1) {
                        qObj.has4k = false;
                        qObj.has1080p = false;
                        qObj.has720p = true;
                    } else if (mq.indexOf('480') !== -1 || mq.indexOf('360') !== -1 || mq.indexOf('sd') !== -1) {
                        qObj.has4k = false;
                        qObj.has1080p = false;
                        qObj.has720p = false;
                        qObj.hasSD = true;
                    }
                }

                var ctObj = {};
                if (entry.contentTypes && typeof entry.contentTypes === 'object') {
                    ctObj = entry.contentTypes;
                }

                items.push(PluginAdapterEngine.normalizeSourceRecord(plugin, {
                    id: balanser || title,
                    name: title,
                    balanser: balanser,
                    url: url,
                    isNativeEntryOnly: false,
                    integrationMode: 'lampac_events',
                    note: 'Получен напрямую с сервера плагина (/lite/events)',
                    qualities: qObj,
                    contentTypes: ctObj
                }));
            }

            return items;
        },

        /**
         * Запрашивает реальные внутренние источники конкретного плагина.
         */
        discoverForPlugin: function (plugin, callback) {
            var self = this;

            // 1. Внешний пользовательский API-адаптер (window.ANDRPROD_API.registerAdapter)
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
                                    var item = list[i];
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

                // Адаптер одного источника (совместимость с ANDRPROD v1.0)
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

            // 2. Адаптер Lampa.Api.sources (актуально для PWA / PVA и каталожных плагинов)
            if (plugin.adapterType === 'lampa_api_or_native') {
                var apiSources = self._inspectLampaApiSources(plugin);
                if (apiSources.length) {
                    callback(apiSources);
                    return;
                }
            }

            // 3. Адаптер Lampac / BWA протокола (/lite/events)
            var origin = self.extractOrigin(plugin.url);
            if (origin && (plugin.adapterType === 'lampac_protocol' || plugin.adapterType === 'lampac_or_native')) {
                self._probeLampacEvents(plugin, origin, function (serverSources) {
                    if (serverSources && serverSources.length) {
                        callback(serverSources);
                    } else {
                        callback(self._buildHonestNativeFallback(plugin));
                    }
                });
                return;
            }

            // 4. Online Mod: проверяем, есть ли в Lampa.Storage реальный активный балансир
            if (plugin.adapterType === 'online_mod') {
                callback(self._buildOnlineModSources(plugin));
                return;
            }

            // 5. Остальные закрытые плагины — честный режим без выдумывания
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
                    var parsed = self.parseLampacEventsPayload(plugin, resp);
                    callback(parsed);
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
                    if (!Lampa.Api.sources.hasOwnProperty(key)) continue;
                    if (builtin[key]) continue;
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
            try {
                activeBalanser = String(Lampa.Storage.get('online_mod_balanser', '') || '');
            } catch (e) {}

            var note = activeBalanser
                ? 'Текущий выбранный балансир в Online Mod: ' + activeBalanser + '. Полный внутренний список закрыт внутри плагина.'
                : 'Внутренние источники скрыты внутри Online Mod — запуск через оригинальный интерфейс плагина.';

            return [
                PluginAdapterEngine.normalizeSourceRecord(plugin, {
                    id: activeBalanser || 'native_entry',
                    name: activeBalanser ? ('Online Mod (' + activeBalanser + ')') : 'Online Mod (оригинальный интерфейс)',
                    balanser: activeBalanser,
                    url: plugin.url || '',
                    isNativeEntryOnly: true,
                    integrationMode: 'plugin_delegate',
                    note: note,
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
                    note: 'Плагин не предоставляет публичный API внутренних источников — запуск через оригинальный механизм плагина.',
                    qualities: {},
                    contentTypes: {}
                })
            ];
        }
    };

    // =========================================================================
    // 5. РЕЕСТР ПЛАГИНОВ И ИСТОЧНИКОВ (SourceRegistry)
    // =========================================================================
    var SourceRegistry = {
        plugins: {},          // pluginId -> plugin metadata
        sources: {},          // sourceKey (pluginId::sourceId) -> normalized source
        customAdapters: {},   // id -> custom adapter
        healthCache: {},      // key (pluginId or sourceKey) -> { status, latency, checkedAt, message }

        resetAndScan: function () {
            var self = this;
            var discoveredPlugins = {};

            // 1. Пользовательские API-адаптеры
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

            // 2. Установленные плагины из Lampa.Storage ('plugins') и Lampa.Manifest.plugins
            var rawPlugins = [];
            try {
                var stored = Lampa.Storage.get('plugins', []);
                if (Object.prototype.toString.call(stored) === '[object Array]') {
                    rawPlugins = rawPlugins.concat(stored);
                }
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
                    pUrl = p;
                    pName = '';
                    pIcon = '';
                } else {
                    if (p.status === 0) continue; // отключён в самой Lampa
                    pUrl = p.url || p.src || '';
                    pName = p.name || p.title || '';
                    pIcon = p.icon || p.picture || p.logo || '';
                }
                if (!pUrl && !pName) continue;

                lowerUrl = String(pUrl).toLowerCase();
                lowerName = String(pName).toLowerCase();

                if (lowerUrl.indexOf('andrprod') !== -1 || lowerName.indexOf('andrprod') !== -1) {
                    continue;
                }

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

            // 3. Встроенные торренты Lampa (если включён парсер)
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

            // Сохраняем плагины, обнаруженные ранее через кнопки карточки
            var oldPid;
            for (oldPid in self.plugins) {
                if (self.plugins.hasOwnProperty(oldPid) && self.plugins[oldPid].detectedVia === 'Кнопка карточки' && !discoveredPlugins[oldPid]) {
                    discoveredPlugins[oldPid] = self.plugins[oldPid];
                }
            }

            self.plugins = discoveredPlugins;

            // Гарантируем, что у каждого обнаруженного плагина есть хотя бы базовый синхронный вход до завершения сетевого опроса
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

        /**
         * Асинхронно раскрывает реальные внутренние источники каждого обнаруженного плагина
         * через его адаптер (без зависания UI).
         */
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
                        // Удаляем старые источники этого плагина и записываем реальные
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
                        for (j = 0; j < listToStore.length; j++) {
                            self.sources[listToStore[j].key] = listToStore[j];
                        }

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
                if (this.plugins.hasOwnProperty(id)) {
                    list.push(this.plugins[id]);
                }
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
                if (this.sources.hasOwnProperty(key) && this.sources[key].pluginId === pluginId) {
                    list.push(this.sources[key]);
                }
            }
            return list;
        },

        getAllSources: function () {
            var list = [];
            var key;
            for (key in this.sources) {
                if (this.sources.hasOwnProperty(key)) {
                    list.push(this.sources[key]);
                }
            }
            return list;
        },

        // Обратная совместимость с ANDRPROD v1.0
        getSortedSources: function (options) {
            options = options || {};
            var filters = getDefaultFilters();
            if (options.onlyFavorites) filters.onlyFavorites = true;
            if (options.hideBroken || (options.respectHideBroken && StorageManager.isHideBroken())) {
                filters.hideUnavailable = true;
            }
            var list = this.getAllSources();
            if (options.onlyEnabled) {
                var enabledOnly = [];
                var i;
                for (i = 0; i < list.length; i++) {
                    if (StorageManager.isEnabled(list[i].key) && StorageManager.isPluginEnabled(list[i].pluginId)) {
                        enabledOnly.push(list[i]);
                    }
                }
                list = enabledOnly;
            }
            return FilterEngine.apply(list, filters);
        },

        getHealth: function (idOrKey) {
            if (this.healthCache[idOrKey]) return this.healthCache[idOrKey];
            // Если передан ключ источника и для него нет кеша — пробуем статус родительского плагина
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
    // 6. СИСТЕМА МНОГОКРИТЕРИАЛЬНОЙ ФИЛЬТРАЦИИ И СОРТИРОВКИ (FilterEngine)
    // =========================================================================
    var FilterEngine = {
        apply: function (sources, filters) {
            filters = filters || StorageManager.getFilters();
            var result = [];
            var qLower = $.trim(String(filters.searchQuery || '')).toLowerCase();
            var i, src, health;

            for (i = 0; i < sources.length; i++) {
                src = sources[i];
                health = SourceRegistry.getHealth(src.key);

                // Скрытые пользователем источники (кроме явного просмотра на странице плагина)
                if (!filters.includeHidden && !StorageManager.isEnabled(src.key)) continue;

                // Поиск по названию плагина и названию источника
                if (qLower) {
                    var hay = (src.name + ' ' + src.pluginName + ' ' + (src.balanser || '')).toLowerCase();
                    if (hay.indexOf(qLower) === -1) continue;
                }

                // Фильтр по плагину
                if (filters.pluginId && filters.pluginId !== 'all' && src.pluginId !== filters.pluginId) {
                    continue;
                }

                // Фильтр качества (СТРОГО по реальным данным, без угадывания по названию!)
                if (filters.quality && filters.quality !== 'all') {
                    if (!FilterEngine.matchesQuality(src, filters.quality)) continue;
                }

                // Дополнительные переключатели качества
                if (filters.only4k && src.qualities.has4k !== true) continue;
                if (filters.onlyFullHd && src.qualities.has1080p !== true) continue;

                // Фильтр по типу контента (СТРОГО по реальным данным)
                if (filters.contentType && filters.contentType !== 'all') {
                    if (!FilterEngine.matchesContentType(src, filters.contentType)) continue;
                }

                // Только рабочие источники
                if (filters.onlyWorking) {
                    if (health.status !== 'online' && health.status !== 'button_only') continue;
                }

                // Скрыть недоступные
                if (filters.hideUnavailable) {
                    if (health.status === 'offline' || health.status === 'unsupported') continue;
                }

                // Только избранные (источник или его плагин)
                if (filters.onlyFavorites) {
                    if (!StorageManager.isFavorite(src.key) && !StorageManager.isPluginFavorite(src.pluginId)) {
                        continue;
                    }
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
                return q.has4k === null && q.has2160p === null && q.has1080p === null && q.has720p === null && q.hasSD === null;
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
            return 0; // Неизвестно
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
                if (sortBy === 'name') {
                    return String(a.name).localeCompare(String(b.name));
                }
                if (sortBy === 'quality') {
                    var qa = FilterEngine.getQualityScore(a);
                    var qb = FilterEngine.getQualityScore(b);
                    if (qa !== qb) return qb - qa;
                    return String(a.name).localeCompare(String(b.name));
                }
                if (sortBy === 'speed') {
                    var ha = SourceRegistry.getHealth(a.key);
                    var hb = SourceRegistry.getHealth(b.key);
                    var la = (ha.status === 'online' && ha.latency > 0) ? ha.latency : 999999;
                    var lb = (hb.status === 'online' && hb.latency > 0) ? hb.latency : 999999;
                    if (la !== lb) return la - lb;
                    return String(a.name).localeCompare(String(b.name));
                }

                // По умолчанию: приоритет пользователя → избранное → доступность → качество → название
                var pa = priorities.indexOf(a.key);
                var pb = priorities.indexOf(b.key);
                if (pa !== -1 && pb !== -1) return pa - pb;
                if (pa !== -1) return -1;
                if (pb !== -1) return 1;

                var fa = StorageManager.isFavorite(a.key) ? 1 : 0;
                var fb = StorageManager.isFavorite(b.key) ? 1 : 0;
                if (fa !== fb) return fb - fa;

                var wa = statusWeight(SourceRegistry.getHealth(a.key).status);
                var wb = statusWeight(SourceRegistry.getHealth(b.key).status);
                if (wa !== wb) return wb - wa;

                var qsa = FilterEngine.getQualityScore(a);
                var qsb = FilterEngine.getQualityScore(b);
                if (qsa !== qsb) return qsb - qsa;

                return String(a.name).localeCompare(String(b.name));
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

    function statusWeight(st) {
        if (st === 'online') return 4;
        if (st === 'button_only') return 3;
        if (st === 'checking' || st === 'unknown') return 2;
        if (st === 'unsupported') return 1;
        return 0;
    }

    // =========================================================================
    // 7. ПРОВЕРКА ДОСТУПНОСТИ ПЛАГИНОВ И ИСТОЧНИКОВ (HealthChecker)
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
                        var res = {
                            status: ok ? 'online' : 'offline',
                            latency: Date.now() - startAd,
                            checkedAt: Date.now(),
                            message: msg || (ok ? 'Доступен' : 'Не отвечает')
                        };
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
                var btnRes = {
                    status: 'button_only',
                    latency: 0,
                    checkedAt: Date.now(),
                    message: 'Запуск через кнопку плагина'
                };
                SourceRegistry.healthCache[cacheKey] = btnRes;
                if (callback) callback(btnRes);
                return;
            }

            SourceRegistry.healthCache[cacheKey] = {
                status: 'checking',
                latency: 0,
                checkedAt: 0,
                message: 'Проверка...'
            };

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
                var resT = {
                    status: 'offline',
                    latency: timeoutMs,
                    checkedAt: Date.now(),
                    message: 'Тайм-аут (' + Math.round(timeoutMs / 1000) + ' с)'
                };
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
                    var resOk = {
                        status: 'online',
                        latency: lat,
                        checkedAt: Date.now(),
                        message: 'Доступен (' + lat + ' мс)'
                    };
                    SourceRegistry.healthCache[cacheKey] = resOk;
                    if (callback) callback(resOk);
                },
                function () {
                    if (done) return;
                    done = true;
                    clearTimeout(guard);
                    var resFail = {
                        status: 'offline',
                        latency: Date.now() - start,
                        checkedAt: Date.now(),
                        message: 'Сервер недоступен'
                    };
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
            var checkFn = (plugin.customAdapter && typeof plugin.customAdapter.check === 'function')
                ? plugin.customAdapter.check
                : null;
            HealthChecker.checkTarget(plugin.id, plugin.url, checkFn, force, callback);
        },

        checkSource: function (src, force, callback) {
            if (!src) {
                if (callback) callback({ status: 'unsupported', latency: 0, checkedAt: Date.now(), message: 'Нет данных' });
                return;
            }
            var checkFn = (src.adapter && typeof src.adapter.check === 'function')
                ? function (cb) { src.adapter.check(cb, src); }
                : null;
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
    // 8. ИНТЕГРАЦИЯ С КАРТОЧКОЙ ФИЛЬМА / СЕРИАЛА (CardIntegration)
    // =========================================================================
    var CardIntegration = {
        lastMovie: null,
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
            CardIntegration.lastMovie = movie;

            var btn = $(
                '<div class="full-start__button selector andrprod-card-btn" data-andrprod="1">' +
                    BrandIcons.getLogoSvg('andrprod-card-btn__logo', 'card_' + (movie.id || '0')) +
                '</div>'
            );

            buttonsContainer.prepend(btn);

            if (StorageManager.isAutoSearch()) {
                setTimeout(function () {
                    CardIntegration.collectCardButtons(buttonsContainer);
                    SourceRegistry.discoverAllPluginSources();
                    HealthChecker.checkAll(false);
                }, 400);
            }

            btn.on('hover:enter', function () {
                CardIntegration.openSourceCenterForMovie(movie, buttonsContainer);
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

                if (
                    lowerLabel.indexOf('трейлер') !== -1 ||
                    lowerLabel.indexOf('trailer') !== -1 ||
                    lowerLabel.indexOf('закладк') !== -1 ||
                    lowerLabel.indexOf('подпис') !== -1
                ) {
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
                    if (lowerLabel.indexOf(hint) !== -1 || lowerCls.indexOf(hint) !== -1) {
                        return prof.id;
                    }
                }
            }
            return null;
        },

        openSourceCenterForMovie: function (movie, buttonsContainer) {
            SourceRegistry.resetAndScan();
            CardIntegration.collectCardButtons(buttonsContainer);
            var buttonMap = CardIntegration.lastButtonMap || {};

            var filters = StorageManager.getFilters();
            var allSources = SourceRegistry.getAllSources();
            var enabledSources = [];
            var i;
            for (i = 0; i < allSources.length; i++) {
                if (StorageManager.isEnabled(allSources[i].key) && StorageManager.isPluginEnabled(allSources[i].pluginId)) {
                    enabledSources.push(allSources[i]);
                }
            }

            var sources = FilterEngine.apply(enabledSources, filters);
            if (!sources.length) sources = FilterEngine.apply(enabledSources, getDefaultFilters());

            if (!sources.length) {
                Lampa.Noty.show('ANDRPROD: Нет активных источников. Проверьте раздел ANDRPROD.');
                return;
            }

            if (StorageManager.getMode() === 'auto') {
                CardIntegration.launchSourceWithFallback(sources, 0, movie, buttonMap);
                return;
            }

            var selectItems = [];
            for (i = 0; i < sources.length; i++) {
                (function (src) {
                    var health = SourceRegistry.getHealth(src.key);
                    var hasBtn = !!buttonMap[src.pluginId];
                    var hasDirect = src.integrationMode === 'direct_adapter';
                    var favStar = StorageManager.isFavorite(src.key) ? '★ ' : '';
                    var qLabel = FilterEngine.getQualityLabel(src);

                    selectItems.push({
                        title: favStar + src.pluginName + ' — ' + src.name,
                        subtitle: 'Качество: ' + qLabel + ' • ' + formatLaunchStatus(health, hasBtn, hasDirect),
                        source: src,
                        canLaunch: hasBtn || hasDirect
                    });
                })(sources[i]);
            }

            selectItems.push({
                title: '⚙ Открыть центр управления ANDRPROD',
                subtitle: 'Плагины, все источники, фильтры и настройки',
                openHub: true
            });

            Lampa.Select.show({
                title: 'ANDRPROD — ' + (movie.title || movie.name || 'Выбор источника'),
                items: selectItems,
                onSelect: function (item) {
                    if (item.openHub) {
                        HubLauncher.open({ view: 'home' });
                        return;
                    }
                    if (!item.canLaunch) {
                        Lampa.Noty.show('ANDRPROD: Плагин «' + item.source.pluginName + '» не добавил кнопку в эту карточку и не имеет прямого адаптера.');
                        return;
                    }
                    var chain = [item.source];
                    var r;
                    for (r = 0; r < sources.length; r++) {
                        if (sources[r].key !== item.source.key) chain.push(sources[r]);
                    }
                    CardIntegration.launchSourceWithFallback(chain, 0, movie, buttonMap);
                },
                onBack: function () {
                    Lampa.Controller.toggle('full_start');
                }
            });
        },

        /**
         * Запускает конкретный источник через оригинальный механизм его плагина.
         * Не изменяет сохранённые настройки других плагинов!
         */
        launchSingleSource: function (src, movie, buttonMap, onFail) {
            if (!src) {
                if (onFail) onFail();
                return false;
            }

            // 1. Прямой API-адаптер
            if (src.integrationMode === 'direct_adapter' && src.adapter && typeof src.adapter.open === 'function') {
                try {
                    src.adapter.open(movie || CardIntegration.lastMovie || {}, function (ok) {
                        if (!ok && onFail) onFail();
                    }, src);
                    return true;
                } catch (eAd) {
                    if (onFail) onFail();
                    return false;
                }
            }

            // 2. Оригинальная кнопка плагина в открытой карточке фильма
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

            // 3. Источник из Lampa.Api.sources (PWA/PVA) — открываем каталог через штатный компонент Lampa
            if (src.integrationMode === 'lampa_api_source') {
                try {
                    Lampa.Activity.push({
                        url: 'movie/popular',
                        title: src.name,
                        component: 'category_full',
                        source: src.id,
                        page: 1
                    });
                    return true;
                } catch (eApi) {}
            }

            if (onFail) onFail();
            return false;
        },

        launchSourceWithFallback: function (sources, index, movie, buttonMap) {
            if (index >= sources.length) {
                Lampa.Noty.show('ANDRPROD: Ни один из выбранных источников не смог открыть этот фильм/сериал.');
                return;
            }
            var src = sources[index];
            CardIntegration.launchSingleSource(src, movie, buttonMap, function () {
                CardIntegration.launchSourceWithFallback(sources, index + 1, movie, buttonMap);
            });
        }
    };

    function formatLaunchStatus(health, hasBtn, hasDirect) {
        if (hasDirect) return 'Прямой API-адаптер' + (health.latency ? ' (' + health.latency + ' мс)' : '');
        if (hasBtn) {
            if (health.status === 'online') return 'Доступен (' + health.latency + ' мс)';
            if (health.status === 'offline') return 'Сервер не ответил • запуск через кнопку';
            return 'Готов к запуску';
        }
        return 'Нет кнопки в текущей карточке';
    }

    // =========================================================================
    // 9. ГЛАВНЫЙ ИНТЕРФЕЙС ANDRPROD v2.0 (HubComponent + Страница плагина)
    // =========================================================================
    var HubLauncher = {
        open: function (params) {
            params = params || {};
            Lampa.Activity.push({
                url: '',
                title: 'ANDRPROD',
                component: HUB_COMPONENT,
                view: params.view || 'home',         // 'home' | 'plugin' | 'all_sources' | 'favorites' | 'movies' | 'series' | 'settings'
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
        var mediaCache = { movie: null, tv: null };
        var isDestroyed = false;

        var NAV_TABS = [
            { id: 'home', title: 'Плагины' },
            { id: 'all_sources', title: 'Все источники' },
            { id: 'favorites', title: 'Избранное' },
            { id: 'movies', title: 'Фильмы' },
            { id: 'series', title: 'Сериалы' },
            { id: 'settings', title: 'Настройки' }
        ];

        this.create = function () {
            SourceRegistry.resetAndScan();
            buildShell();
            renderCurrentView();

            // Раскрываем реальные источники установленных плагинов в фоне
            SourceRegistry.discoverAllPluginSources(function () {
                if (!isDestroyed) {
                    updateHeaderStats();
                    if (currentView === 'home' || currentView === 'plugin' || currentView === 'all_sources' || currentView === 'favorites') {
                        renderCurrentView(true);
                    }
                }
            });

            if (StorageManager.isAutoSearch()) {
                HealthChecker.checkAll(false, function () {
                    if (!isDestroyed) {
                        updateHeaderStats();
                        if (currentView === 'home' || currentView === 'plugin' || currentView === 'all_sources' || currentView === 'favorites') {
                            renderCurrentView(true);
                        }
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

            topbarEl.find('.andrprod-btn-search').on('hover:enter', function () {
                openSearchInput();
            });

            topbarEl.find('.andrprod-btn-filters').on('hover:enter', function () {
                openFiltersMenu();
            });

            topbarEl.find('.andrprod-btn-refresh').on('hover:enter', function () {
                Lampa.Noty.show('ANDRPROD: Обновление плагинов, источников и проверка доступности...');
                SourceRegistry.resetAndScan();
                SourceRegistry.discoverAllPluginSources(null, function () {
                    HealthChecker.checkAll(true, null, function () {
                        if (!isDestroyed) {
                            updateHeaderStats();
                            renderCurrentView(true);
                            Lampa.Noty.show('ANDRPROD: Каталог источников обновлён.');
                        }
                    });
                });
            });

            navEl = $('<div class="andrprod-hub__tabs"></div>');
            var i;
            for (i = 0; i < NAV_TABS.length; i++) {
                (function (tab) {
                    var tabBtn = $(
                        '<div class="andrprod-tab selector" data-view="' + tab.id + '">' +
                            tab.title +
                        '</div>'
                    );
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

            topbarEl.find('.andrprod-btn-filters').text(
                activeFilterCount > 0 ? ('Фильтры (' + activeFilterCount + ')') : 'Фильтры'
            );
        }

        function renderCurrentView(preserveFocus) {
            if (isDestroyed) return;
            updateHeaderStats();
            updateNavActive();
            bodyEl.empty();

            if (currentView === 'home') {
                renderHomePluginsView();
            } else if (currentView === 'plugin') {
                renderPluginDetailView(selectedPluginId);
            } else if (currentView === 'all_sources') {
                renderAllSourcesCatalog();
            } else if (currentView === 'favorites') {
                renderFavoritesView();
            } else if (currentView === 'movies') {
                renderMediaCatalog('movie');
            } else if (currentView === 'series') {
                renderMediaCatalog('tv');
            } else if (currentView === 'settings') {
                renderSettingsView();
            }

            if (!preserveFocus) {
                Lampa.Controller.collectionSet(html);
                var firstFocus = bodyEl.find('.selector')[0] || navEl.find('.andrprod-tab.is-active')[0];
                if (firstFocus) Lampa.Controller.collectionFocus(firstFocus, html);
            } else {
                Lampa.Controller.collectionSet(html);
            }
        }

        // ---------------------------------------------------------------------
        // ГЛАВНАЯ СТРАНИЦА: КАРТОЧКИ УСТАНОВЛЕННЫХ ПЛАГИНОВ
        // ---------------------------------------------------------------------
        function renderHomePluginsView() {
            var filters = StorageManager.getFilters();
            var plugins = SourceRegistry.getPlugins();
            var qLower = $.trim(String(filters.searchQuery || '')).toLowerCase();

            // Панель активных фильтров / сброса поиска
            renderActiveFilterStrip(filters);

            var filteredPlugins = [];
            var i;
            for (i = 0; i < plugins.length; i++) {
                var pl = plugins[i];
                if (filters.pluginId !== 'all' && pl.id !== filters.pluginId) continue;

                var plSources = SourceRegistry.getPluginSources(pl.id);
                var matchingSources = FilterEngine.apply(plSources, filters);

                if (qLower) {
                    var nameMatch = String(pl.name).toLowerCase().indexOf(qLower) !== -1;
                    if (!nameMatch && !matchingSources.length) continue;
                } else if (FilterEngine.countActiveFilters(filters) > 0 && !matchingSources.length) {
                    continue;
                }

                filteredPlugins.push({
                    plugin: pl,
                    totalSources: plSources.length,
                    matchingSources: matchingSources.length
                });
            }

            if (!filteredPlugins.length) {
                bodyEl.append(
                    '<div class="andrprod-empty">' +
                        '<div class="andrprod-empty__title">Подходящие плагины не найдены</div>' +
                        '<div class="andrprod-empty__desc">' +
                            (plugins.length
                                ? 'Попробуйте сбросить активные фильтры или строку поиска.'
                                : 'Установите онлайн-плагины в Lampa (Настройки → Расширения) и нажмите «Обновить».') +
                        '</div>' +
                    '</div>'
                );
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
                                    '<div class="andrprod-plugin-card__name">' +
                                        escapeHtml(pl.name) +
                                        (fav ? ' <span class="andrprod-star">★</span>' : '') +
                                    '</div>' +
                                    '<div class="andrprod-plugin-card__count">' +
                                        'Источников: <b>' + item.totalSources + '</b>' +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                            '<div class="andrprod-plugin-card__bottom">' +
                                '<div class="andrprod-status-line">' +
                                    '<span class="andrprod-status-dot ' + getStatusDotClass(health.status) + '"></span>' +
                                    '<span>' + escapeHtml(getStatusHumanLabel(health)) + '</span>' +
                                '</div>' +
                                '<div class="andrprod-open-cta">Открыть →</div>' +
                            '</div>' +
                        '</div>'
                    );

                    card.on('hover:enter', function () {
                        selectedPluginId = pl.id;
                        currentView = 'plugin';
                        renderCurrentView();
                    });

                    card.on('hover:focus', function () {
                        lastFocused = card[0];
                        scroll.update(card, true);
                    });

                    grid.append(card);
                })(filteredPlugins[i]);
            }

            bodyEl.append(grid);
        }

        // ---------------------------------------------------------------------
        // СТРАНИЦА КОНКРЕТНОГО ПЛАГИНА (например, ALPACA / LAMPAC)
        // ---------------------------------------------------------------------
        function renderPluginDetailView(pluginId) {
            var pl = SourceRegistry.getPluginById(pluginId);
            if (!pl) {
                currentView = 'home';
                renderHomePluginsView();
                return;
            }

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
                                escapeHtml(getStatusHumanLabel(health)) +
                                ' • Источников: ' + allPlSources.length +
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

            detailHead.find('.andrprod-btn-back').on('hover:enter', function () {
                currentView = 'home';
                selectedPluginId = '';
                renderCurrentView();
            });

            detailHead.find('.andrprod-btn-pl-fav').on('hover:enter', function () {
                StorageManager.togglePluginFavorite(pl.id);
                renderCurrentView();
            });

            detailHead.find('.andrprod-btn-pl-check').on('hover:enter', function () {
                Lampa.Noty.show('Проверка ' + pl.name + '...');
                PluginAdapterEngine.discoverForPlugin(pl, function (list) {
                    var k;
                    for (k in SourceRegistry.sources) {
                        if (SourceRegistry.sources.hasOwnProperty(k) && SourceRegistry.sources[k].pluginId === pl.id) {
                            delete SourceRegistry.sources[k];
                        }
                    }
                    var j;
                    for (j = 0; j < list.length; j++) SourceRegistry.sources[list[j].key] = list[j];
                    HealthChecker.checkPlugin(pl, true, function () {
                        if (!isDestroyed) renderCurrentView();
                    });
                });
            });

            bodyEl.append(detailHead);
            renderActiveFilterStrip(filters);

            if (!filteredSources.length) {
                bodyEl.append(
                    '<div class="andrprod-empty">' +
                        '<div class="andrprod-empty__title">Нет источников, соответствующих фильтрам</div>' +
                        '<div class="andrprod-empty__desc">Сбросьте фильтры, чтобы увидеть все источники плагина ' + escapeHtml(pl.name) + '.</div>' +
                    '</div>'
                );
                return;
            }

            var listEl = $('<div class="andrprod-source-list"></div>');
            var i;
            for (i = 0; i < filteredSources.length; i++) {
                listEl.append(buildSourceCard(filteredSources[i], false));
            }
            bodyEl.append(listEl);
        }

        // ---------------------------------------------------------------------
        // ОБЩИЙ КАТАЛОГ «ВСЕ ИСТОЧНИКИ»
        // ---------------------------------------------------------------------
        function renderAllSourcesCatalog() {
            var filters = StorageManager.getFilters();
            renderActiveFilterStrip(filters);

            var all = SourceRegistry.getAllSources();
            var filtered = FilterEngine.apply(all, filters);

            var info = $(
                '<div class="andrprod-info-bar">' +
                    '<span>Показано источников: <b>' + filtered.length + '</b> из ' + all.length + '</span>' +
                    '<span>Сортировка: <b>' + getSortLabel(filters.sortBy) + '</b></span>' +
                '</div>'
            );
            bodyEl.append(info);

            if (!filtered.length) {
                bodyEl.append(
                    '<div class="andrprod-empty">' +
                        '<div class="andrprod-empty__title">Источники по заданным фильтрам не найдены</div>' +
                        '<div class="andrprod-empty__desc">Измените условия фильтрации или обновите список плагинов.</div>' +
                    '</div>'
                );
                return;
            }

            var listEl = $('<div class="andrprod-source-list"></div>');
            var i;
            for (i = 0; i < filtered.length; i++) {
                listEl.append(buildSourceCard(filtered[i], true));
            }
            bodyEl.append(listEl);
        }

        function buildSourceCard(src, showPluginBadge) {
            var enabled = StorageManager.isEnabled(src.key);
            var fav = StorageManager.isFavorite(src.key);
            var health = SourceRegistry.getHealth(src.key);
            var qLabel = FilterEngine.getQualityLabel(src);

            var capHtml = '' +
                '<span class="andrprod-chip">Качество: <b>' + escapeHtml(qLabel) + '</b></span>' +
                '<span class="andrprod-chip">4K: ' + formatTriState(src.qualities.has4k) + '</span>' +
                '<span class="andrprod-chip">Full HD: ' + formatTriState(src.qualities.has1080p) + '</span>' +
                '<span class="andrprod-chip">HD: ' + formatTriState(src.qualities.has720p) + '</span>' +
                '<span class="andrprod-chip">Фильмы: ' + formatTriState(src.contentTypes.movies) + '</span>' +
                '<span class="andrprod-chip">Сериалы: ' + formatTriState(src.contentTypes.series) + '</span>';

            var card = $(
                '<div class="andrprod-source-card selector ' + (enabled ? '' : 'is-disabled') + '">' +
                    '<div class="andrprod-source-card__main">' +
                        '<div class="andrprod-source-card__header">' +
                            '<span class="andrprod-status-dot ' + getStatusDotClass(health.status) + '"></span>' +
                            (showPluginBadge ? '<span class="andrprod-plugin-tag">' + escapeHtml(src.pluginName) + '</span>' : '') +
                            '<span class="andrprod-source-card__title">' +
                                escapeHtml(src.name) +
                                (fav ? ' <span class="andrprod-star">★</span>' : '') +
                            '</span>' +
                        '</div>' +
                        '<div class="andrprod-chips-row">' + capHtml + '</div>' +
                        '<div class="andrprod-source-card__sub">' +
                            escapeHtml(getStatusHumanLabel(health)) +
                            ' • Проверка: ' + (health.checkedAt ? formatTime(health.checkedAt) : 'Не выполнялась') +
                            (src.note ? ' • ' + escapeHtml(src.note) : '') +
                        '</div>' +
                    '</div>' +
                    '<div class="andrprod-source-card__right">' +
                        '<span class="andrprod-badge ' + (enabled ? 'is-on' : 'is-off') + '">' +
                            (enabled ? 'Активен' : 'Скрыт') +
                        '</span>' +
                    '</div>' +
                '</div>'
            );

            card.on('hover:enter', function () {
                openSourceActionMenu(src, showPluginBadge);
            });

            card.on('hover:focus', function () {
                lastFocused = card[0];
                scroll.update(card, true);
            });

            return card;
        }

        function openSourceActionMenu(src, allowJumpToPlugin) {
            var enabled = StorageManager.isEnabled(src.key);
            var fav = StorageManager.isFavorite(src.key);
            var health = SourceRegistry.getHealth(src.key);

            var items = [
                {
                    title: '▶ Запустить источник',
                    subtitle: 'Открыть через оригинальный механизм плагина ' + src.pluginName,
                    action: 'launch'
                }
            ];

            if (allowJumpToPlugin) {
                items.push({
                    title: 'Перейти к плагину «' + src.pluginName + '»',
                    subtitle: 'Открыть страницу плагина и все его источники',
                    action: 'open_plugin'
                });
            }

            items.push(
                {
                    title: fav ? 'Убрать из избранных' : 'Добавить в избранные ★',
                    action: 'toggle_fav'
                },
                {
                    title: 'Поднять приоритет ▲',
                    action: 'move_up'
                },
                {
                    title: 'Понизить приоритет ▼',
                    action: 'move_down'
                },
                {
                    title: enabled ? 'Скрыть источник' : 'Показать источник',
                    action: 'toggle_enable'
                },
                {
                    title: 'Проверить доступность сейчас',
                    subtitle: health.message || '',
                    action: 'ping'
                }
            );

            Lampa.Select.show({
                title: src.pluginName + ' — ' + src.name,
                items: items,
                onSelect: function (item) {
                    if (item.action === 'launch') {
                        var launched = CardIntegration.launchSingleSource(src, CardIntegration.lastMovie, CardIntegration.lastButtonMap);
                        if (!launched) {
                            Lampa.Noty.show('ANDRPROD: Откройте любой фильм или сериал и выберите «' + src.name + '» через кнопку ANDRPROD.');
                            currentView = 'movies';
                            renderCurrentView();
                        }
                        return;
                    }
                    if (item.action === 'open_plugin') {
                        selectedPluginId = src.pluginId;
                        currentView = 'plugin';
                        renderCurrentView();
                        return;
                    }
                    if (item.action === 'toggle_fav') {
                        StorageManager.toggleFavorite(src.key);
                        renderCurrentView();
                    } else if (item.action === 'move_up') {
                        StorageManager.movePriority(src.key, -1);
                        renderCurrentView();
                    } else if (item.action === 'move_down') {
                        StorageManager.movePriority(src.key, 1);
                        renderCurrentView();
                    } else if (item.action === 'toggle_enable') {
                        StorageManager.setEnabled(src.key, !enabled);
                        renderCurrentView();
                    } else if (item.action === 'ping') {
                        Lampa.Noty.show('Проверка ' + src.name + '...');
                        HealthChecker.checkSource(src, true, function (res) {
                            Lampa.Noty.show(src.name + ': ' + (res.message || res.status));
                            if (!isDestroyed) renderCurrentView();
                        });
                    }
                    Lampa.Controller.toggle('content');
                },
                onBack: function () {
                    Lampa.Controller.toggle('content');
                }
            });
        }

        // ---------------------------------------------------------------------
        // ИЗБРАННОЕ (ПЛАГИНЫ + ИСТОЧНИКИ)
        // ---------------------------------------------------------------------
        function renderFavoritesView() {
            var plugins = SourceRegistry.getPlugins();
            var favPlugins = [];
            var i;
            for (i = 0; i < plugins.length; i++) {
                if (StorageManager.isPluginFavorite(plugins[i].id)) favPlugins.push(plugins[i]);
            }

            var allSources = SourceRegistry.getAllSources();
            var favSources = [];
            for (i = 0; i < allSources.length; i++) {
                if (StorageManager.isFavorite(allSources[i].key)) favSources.push(allSources[i]);
            }

            if (!favPlugins.length && !favSources.length) {
                bodyEl.append(
                    '<div class="andrprod-empty">' +
                        '<div class="andrprod-empty__title">В избранном пока пусто</div>' +
                        '<div class="andrprod-empty__desc">Добавляйте любимые плагины и источники звёздочкой ★ — они всегда будут под рукой.</div>' +
                    '</div>'
                );
                return;
            }

            if (favPlugins.length) {
                bodyEl.append('<div class="andrprod-section-title">Избранные плагины (' + favPlugins.length + ')</div>');
                var pGrid = $('<div class="andrprod-plugin-grid"></div>');
                for (i = 0; i < favPlugins.length; i++) {
                    (function (pl) {
                        var health = SourceRegistry.getHealth(pl.id);
                        var card = $(
                            '<div class="andrprod-plugin-card selector">' +
                                '<div class="andrprod-plugin-card__top">' +
                                    BrandIcons.getPluginIconHtml(pl) +
                                    '<div class="andrprod-plugin-card__info">' +
                                        '<div class="andrprod-plugin-card__name">' + escapeHtml(pl.name) + ' <span class="andrprod-star">★</span></div>' +
                                        '<div class="andrprod-plugin-card__count">Источников: <b>' + SourceRegistry.getPluginSources(pl.id).length + '</b></div>' +
                                    '</div>' +
                                '</div>' +
                                '<div class="andrprod-plugin-card__bottom">' +
                                    '<div class="andrprod-status-line">' +
                                        '<span class="andrprod-status-dot ' + getStatusDotClass(health.status) + '"></span>' +
                                        '<span>' + escapeHtml(getStatusHumanLabel(health)) + '</span>' +
                                    '</div>' +
                                    '<div class="andrprod-open-cta">Открыть →</div>' +
                                '</div>' +
                            '</div>'
                        );
                        card.on('hover:enter', function () {
                            selectedPluginId = pl.id;
                            currentView = 'plugin';
                            renderCurrentView();
                        });
                        card.on('hover:focus', function () {
                            lastFocused = card[0];
                            scroll.update(card, true);
                        });
                        pGrid.append(card);
                    })(favPlugins[i]);
                }
                bodyEl.append(pGrid);
            }

            if (favSources.length) {
                bodyEl.append('<div class="andrprod-section-title">Избранные источники (' + favSources.length + ')</div>');
                var sList = $('<div class="andrprod-source-list"></div>');
                for (i = 0; i < favSources.length; i++) {
                    sList.append(buildSourceCard(favSources[i], true));
                }
                bodyEl.append(sList);
            }
        }

        // ---------------------------------------------------------------------
        // ФИЛЬТРЫ И ПОИСК (ИНТЕРАКТИВНЫЕ МЕНЮ ДЛЯ ПУЛЬТА ТВ)
        // ---------------------------------------------------------------------
        function renderActiveFilterStrip(filters) {
            var count = FilterEngine.countActiveFilters(filters);
            if (!count) return;

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

            var resetBtn = $('<div class="andrprod-pill selector andrprod-btn-reset">Сбросить</div>');
            resetBtn.on('hover:enter', function () {
                StorageManager.resetFilters();
                renderCurrentView();
            });
            strip.append(resetBtn);
            bodyEl.append(strip);
        }

        function openSearchInput() {
            var cur = StorageManager.getFilters().searchQuery || '';
            if (Lampa.Input && typeof Lampa.Input.edit === 'function') {
                Lampa.Input.edit({
                    title: 'Поиск по плагинам и источникам',
                    value: cur,
                    free: true,
                    nosave: true
                }, function (newVal) {
                    StorageManager.setFilters({ searchQuery: $.trim(String(newVal || '')) });
                    renderCurrentView();
                    Lampa.Controller.toggle('content');
                });
            } else {
                var entered = window.prompt ? window.prompt('Поиск по плагинам и источникам:', cur) : '';
                if (entered !== null) {
                    StorageManager.setFilters({ searchQuery: $.trim(String(entered || '')) });
                    renderCurrentView();
                }
            }
        }

        function openFiltersMenu() {
            var f = StorageManager.getFilters();
            var pl = f.pluginId !== 'all' ? SourceRegistry.getPluginById(f.pluginId) : null;

            var items = [
                { title: 'Качество видео', subtitle: getQualityFilterName(f.quality), action: 'quality' },
                { title: 'Тип контента', subtitle: getContentTypeName(f.contentType), action: 'contentType' },
                { title: 'Плагин', subtitle: pl ? pl.name : 'Все плагины', action: 'pluginId' },
                { title: 'Сортировка', subtitle: getSortLabel(f.sortBy), action: 'sortBy' },
                { title: 'Только рабочие источники', subtitle: f.onlyWorking ? 'Включено ✓' : 'Выключено', action: 'toggle_working' },
                { title: 'Только избранные', subtitle: f.onlyFavorites ? 'Включено ✓' : 'Выключено', action: 'toggle_favs' },
                { title: 'Только источники с 4K', subtitle: f.only4k ? 'Включено ✓' : 'Выключено', action: 'toggle_4k' },
                { title: 'Только источники с Full HD', subtitle: f.onlyFullHd ? 'Включено ✓' : 'Выключено', action: 'toggle_fhd' },
                { title: 'Скрыть недоступные', subtitle: f.hideUnavailable ? 'Включено ✓' : 'Выключено', action: 'toggle_hide' },
                { title: '↺ Сбросить все фильтры', subtitle: 'Вернуть отображение всех источников', action: 'reset' }
            ];

            Lampa.Select.show({
                title: 'Фильтры ANDRPROD',
                items: items,
                onSelect: function (item) {
                    if (item.action === 'quality') {
                        openQualitySubmenu();
                    } else if (item.action === 'contentType') {
                        openContentTypeSubmenu();
                    } else if (item.action === 'pluginId') {
                        openPluginSubmenu();
                    } else if (item.action === 'sortBy') {
                        openSortSubmenu();
                    } else if (item.action === 'toggle_working') {
                        StorageManager.setFilters({ onlyWorking: !f.onlyWorking });
                        renderCurrentView();
                        openFiltersMenu();
                    } else if (item.action === 'toggle_favs') {
                        StorageManager.setFilters({ onlyFavorites: !f.onlyFavorites });
                        renderCurrentView();
                        openFiltersMenu();
                    } else if (item.action === 'toggle_4k') {
                        StorageManager.setFilters({ only4k: !f.only4k });
                        renderCurrentView();
                        openFiltersMenu();
                    } else if (item.action === 'toggle_fhd') {
                        StorageManager.setFilters({ onlyFullHd: !f.onlyFullHd });
                        renderCurrentView();
                        openFiltersMenu();
                    } else if (item.action === 'toggle_hide') {
                        StorageManager.setFilters({ hideUnavailable: !f.hideUnavailable });
                        renderCurrentView();
                        openFiltersMenu();
                    } else if (item.action === 'reset') {
                        StorageManager.resetFilters();
                        renderCurrentView();
                        Lampa.Controller.toggle('content');
                    }
                },
                onBack: function () {
                    Lampa.Controller.toggle('content');
                }
            });
        }

        function openQualitySubmenu() {
            var cur = StorageManager.getFilters().quality;
            var opts = [
                { id: 'all', title: 'Любое качество' },
                { id: '4k', title: '4K / UHD' },
                { id: '2160p', title: '2160p' },
                { id: '1080p', title: '1080p / Full HD' },
                { id: '720p', title: '720p / HD' },
                { id: 'sd', title: 'SD' },
                { id: 'unknown', title: 'Неизвестное качество' }
            ];
            var i;
            for (i = 0; i < opts.length; i++) opts[i].selected = opts[i].id === cur;
            Lampa.Select.show({
                title: 'Фильтр качества',
                items: opts,
                onSelect: function (item) {
                    StorageManager.setFilters({ quality: item.id });
                    renderCurrentView();
                    openFiltersMenu();
                },
                onBack: function () { openFiltersMenu(); }
            });
        }

        function openContentTypeSubmenu() {
            var cur = StorageManager.getFilters().contentType;
            var opts = [
                { id: 'all', title: 'Всё' },
                { id: 'movie', title: 'Фильмы' },
                { id: 'series', title: 'Сериалы' },
                { id: 'cartoon', title: 'Мультфильмы' },
                { id: 'anime', title: 'Аниме' }
            ];
            var i;
            for (i = 0; i < opts.length; i++) opts[i].selected = opts[i].id === cur;
            Lampa.Select.show({
                title: 'Тип контента',
                items: opts,
                onSelect: function (item) {
                    StorageManager.setFilters({ contentType: item.id });
                    renderCurrentView();
                    openFiltersMenu();
                },
                onBack: function () { openFiltersMenu(); }
            });
        }

        function openPluginSubmenu() {
            var cur = StorageManager.getFilters().pluginId;
            var plugins = SourceRegistry.getPlugins();
            var opts = [{ id: 'all', title: 'Все плагины', selected: cur === 'all' }];
            var i;
            for (i = 0; i < plugins.length; i++) {
                opts.push({
                    id: plugins[i].id,
                    title: 'Только ' + plugins[i].name,
                    selected: cur === plugins[i].id
                });
            }
            Lampa.Select.show({
                title: 'Фильтр по плагину',
                items: opts,
                onSelect: function (item) {
                    StorageManager.setFilters({ pluginId: item.id });
                    renderCurrentView();
                    openFiltersMenu();
                },
                onBack: function () { openFiltersMenu(); }
            });
        }

        function openSortSubmenu() {
            var cur = StorageManager.getFilters().sortBy;
            var opts = [
                { id: 'priority', title: 'По приоритету и избранному' },
                { id: 'quality', title: 'По качеству (сначала лучшие)' },
                { id: 'speed', title: 'По скорости ответа' },
                { id: 'name', title: 'По названию (А–Я)' }
            ];
            var i;
            for (i = 0; i < opts.length; i++) opts[i].selected = opts[i].id === cur;
            Lampa.Select.show({
                title: 'Сортировка источников',
                items: opts,
                onSelect: function (item) {
                    StorageManager.setFilters({ sortBy: item.id });
                    renderCurrentView();
                    openFiltersMenu();
                },
                onBack: function () { openFiltersMenu(); }
            });
        }

        // ---------------------------------------------------------------------
        // КАТАЛОГИ ФИЛЬМОВ И СЕРИАЛОВ (из Lampa API)
        // ---------------------------------------------------------------------
        function renderMediaCatalog(mediaType) {
            if (mediaCache[mediaType] && mediaCache[mediaType].length) {
                drawMediaGrid(mediaCache[mediaType], mediaType);
                return;
            }
            bodyEl.append('<div class="andrprod-loading">Загрузка каталога из Lampa API...</div>');
            try {
                var apiSource = Lampa.Storage.get('source', 'tmdb');
                var apiUrl = mediaType === 'movie' ? 'movie/popular' : 'tv/popular';
                Lampa.Api.list(
                    { url: apiUrl, page: 1, source: apiSource },
                    function (data) {
                        if (isDestroyed) return;
                        var results = (data && data.results) ? data.results : [];
                        mediaCache[mediaType] = results;
                        bodyEl.empty();
                        if (!results.length) {
                            bodyEl.append('<div class="andrprod-empty"><div class="andrprod-empty__title">Каталог пуст</div></div>');
                        } else {
                            drawMediaGrid(results, mediaType);
                        }
                        Lampa.Controller.collectionSet(html);
                    },
                    function () {
                        if (isDestroyed) return;
                        bodyEl.empty();
                        bodyEl.append('<div class="andrprod-empty"><div class="andrprod-empty__title">Не удалось загрузить каталог</div><div class="andrprod-empty__desc">Проверьте основной источник метаданных (TMDB / CUB) в настройках Lampa.</div></div>');
                        Lampa.Controller.collectionSet(html);
                    }
                );
            } catch (err) {
                bodyEl.empty();
                bodyEl.append('<div class="andrprod-empty"><div class="andrprod-empty__title">Каталог временно недоступен</div></div>');
            }
        }

        function drawMediaGrid(items, mediaType) {
            var grid = $('<div class="andrprod-media-grid"></div>');
            var limit = Math.min(items.length, 24);
            var i;
            for (i = 0; i < limit; i++) {
                (function (cardData) {
                    var title = cardData.title || cardData.name || 'Без названия';
                    var year = (cardData.release_date || cardData.first_air_date || '').slice(0, 4);
                    var rating = cardData.vote_average ? Number(cardData.vote_average).toFixed(1) : '';
                    var poster = '';
                    try {
                        poster = cardData.poster_path ? Lampa.TMDB.image('t/p/w300' + cardData.poster_path) : (cardData.img || '');
                    } catch (eImg) {
                        poster = cardData.img || '';
                    }

                    var tile = $(
                        '<div class="andrprod-media-card selector">' +
                            '<div class="andrprod-media-card__poster" style="' + (poster ? 'background-image:url(\'' + poster + '\')' : '') + '">' +
                                (rating ? '<span class="andrprod-media-card__rate">' + escapeHtml(rating) + '</span>' : '') +
                            '</div>' +
                            '<div class="andrprod-media-card__title">' + escapeHtml(title) + '</div>' +
                            '<div class="andrprod-media-card__year">' + escapeHtml(year || (mediaType === 'tv' ? 'Сериал' : 'Фильм')) + '</div>' +
                        '</div>'
                    );

                    tile.on('hover:enter', function () {
                        Lampa.Activity.push({
                            url: '',
                            component: 'full',
                            id: cardData.id,
                            method: mediaType === 'tv' ? 'tv' : 'movie',
                            card: cardData,
                            source: cardData.source || Lampa.Storage.get('source', 'tmdb')
                        });
                    });

                    tile.on('hover:focus', function () {
                        lastFocused = tile[0];
                        scroll.update(tile, true);
                    });

                    grid.append(tile);
                })(items[i]);
            }
            bodyEl.append(grid);
        }

        // ---------------------------------------------------------------------
        // НАСТРОЙКИ ВНУТРИ HUB
        // ---------------------------------------------------------------------
        function renderSettingsView() {
            var list = $('<div class="andrprod-settings-list"></div>');
            var rows = [
                {
                    title: 'Режим выбора источника в карточке',
                    desc: 'Ручной открывает список источников; Автоматический сразу запускает лучший рабочий.',
                    value: StorageManager.getMode() === 'auto' ? 'Автоматический' : 'Ручной',
                    onEnter: function () {
                        StorageManager.setMode(StorageManager.getMode() === 'auto' ? 'manual' : 'auto');
                        renderCurrentView();
                    }
                },
                {
                    title: 'Автоматическая проверка доступности',
                    desc: 'Обновлять статус плагинов и источников при открытии ANDRPROD и карточек.',
                    value: StorageManager.isAutoSearch() ? 'Включено' : 'Выключено',
                    onEnter: function () {
                        StorageManager.setAutoSearch(!StorageManager.isAutoSearch());
                        renderCurrentView();
                    }
                },
                {
                    title: 'Скрывать недоступные источники по умолчанию',
                    desc: 'Исключать источники со статусом «Недоступен» из списков.',
                    value: StorageManager.isHideBroken() ? 'Да' : 'Нет',
                    onEnter: function () {
                        var next = !StorageManager.isHideBroken();
                        StorageManager.setHideBroken(next);
                        StorageManager.setFilters({ hideUnavailable: next });
                        renderCurrentView();
                    }
                },
                {
                    title: 'Тайм-аут сетевой проверки',
                    desc: 'Ограничение времени ожидания ответа сервера источника.',
                    value: Math.round(StorageManager.getTimeout() / 1000) + ' сек',
                    onEnter: function () {
                        var opts = [3000, 5000, 8000, 12000];
                        var idx = opts.indexOf(StorageManager.getTimeout());
                        StorageManager.setTimeoutMs(opts[(idx + 1) % opts.length]);
                        renderCurrentView();
                    }
                },
                {
                    title: 'Сбросить сохранённые фильтры',
                    desc: 'Вернуть все фильтры качества, контента и сортировки к значениям по умолчанию.',
                    value: 'Сбросить',
                    onEnter: function () {
                        StorageManager.resetFilters();
                        Lampa.Noty.show('ANDRPROD: Фильтры сброшены.');
                        renderCurrentView();
                    }
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
                    el.on('hover:focus', function () {
                        lastFocused = el[0];
                        scroll.update(el, true);
                    });
                    list.append(el);
                })(rows[i]);
            }
            bodyEl.append(list);
        }

        // ---------------------------------------------------------------------
        // УПРАВЛЕНИЕ ПУЛЬТОМ ТВ (Lampa.Controller)
        // ---------------------------------------------------------------------
        this.start = function () {
            Lampa.Controller.add('content', {
                toggle: function () {
                    Lampa.Controller.collectionSet(html);
                    Lampa.Controller.collectionFocus(lastFocused || navEl.find('.andrprod-tab.is-active')[0] || false, html);
                },
                left: function () {
                    if (Navigator.canmove('left')) Navigator.move('left');
                    else Lampa.Controller.toggle('menu');
                },
                right: function () {
                    Navigator.move('right');
                },
                up: function () {
                    if (Navigator.canmove('up')) Navigator.move('up');
                    else Lampa.Controller.toggle('head');
                },
                down: function () {
                    Navigator.move('down');
                },
                back: function () {
                    if (currentView === 'plugin') {
                        currentView = 'home';
                        selectedPluginId = '';
                        renderCurrentView();
                    } else {
                        Lampa.Activity.backward();
                    }
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
    // 10. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ФОРМАТИРОВАНИЯ
    // =========================================================================
    function formatTriState(val) {
        if (val === true) return '<b class="is-yes">Да</b>';
        if (val === false) return '<span class="is-no">Нет</span>';
        return '<span class="is-unk">Неизвестно</span>';
    }

    function formatTime(ts) {
        try {
            var d = new Date(ts);
            var hh = ('0' + d.getHours()).slice(-2);
            var mm = ('0' + d.getMinutes()).slice(-2);
            var ss = ('0' + d.getSeconds()).slice(-2);
            return hh + ':' + mm + ':' + ss;
        } catch (e) {
            return '';
        }
    }

    function getStatusDotClass(status) {
        if (status === 'online') return 'is-online';
        if (status === 'button_only') return 'is-ready';
        if (status === 'offline') return 'is-offline';
        if (status === 'checking') return 'is-checking';
        return 'is-unknown';
    }

    function getStatusHumanLabel(health) {
        if (!health) return 'Неизвестно';
        if (health.status === 'online') return 'Доступен' + (health.latency ? ' (' + health.latency + ' мс)' : '');
        if (health.status === 'button_only') return 'Готов (через кнопку плагина)';
        if (health.status === 'offline') return health.message || 'Недоступен';
        if (health.status === 'checking') return 'Проверка...';
        return 'Не проверен';
    }

    function getQualityFilterName(id) {
        var map = {
            all: 'Любое',
            '4k': '4K / UHD',
            '2160p': '2160p',
            '1080p': '1080p / Full HD',
            '720p': '720p / HD',
            sd: 'SD',
            unknown: 'Неизвестное'
        };
        return map[id] || id;
    }

    function getContentTypeName(id) {
        var map = {
            all: 'Всё',
            movie: 'Фильмы',
            series: 'Сериалы',
            cartoon: 'Мультфильмы',
            anime: 'Аниме'
        };
        return map[id] || id;
    }

    function getSortLabel(id) {
        var map = {
            priority: 'По приоритету',
            quality: 'По качеству',
            speed: 'По скорости ответа',
            name: 'По названию'
        };
        return map[id] || id;
    }

    function makeSafeId(str) {
        return String(str || 'src')
            .toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/[^a-z0-9а-яё]+/gi, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 36) || 'src_custom';
    }

    function extractPluginLabel(url) {
        try {
            var clean = String(url).split('?')[0].split('#')[0];
            var parts = clean.split('/');
            var file = parts[parts.length - 1] || parts[parts.length - 2] || 'Plugin';
            file = file.replace(/\.js$/i, '').replace(/[_-]+/g, ' ');
            if (!file) return 'Плагин';
            return file.charAt(0).toUpperCase() + file.slice(1);
        } catch (e) {
            return 'Плагин';
        }
    }

    function cloneObj(obj) {
        var out = {};
        var k;
        for (k in obj) {
            if (obj.hasOwnProperty(k)) out[k] = obj[k];
        }
        return out;
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // =========================================================================
    // 11. БОКОВОЕ МЕНЮ И НАСТРОЙКИ LAMPA (SettingsIntegration)
    // =========================================================================
    function addSidebarMenuItem() {
        try {
            var menuList = $('.menu .menu__list').eq(0);
            if (!menuList.length) return;
            if (menuList.find('.andrprod-menu-item').length) return;

            var item = $(
                '<li class="menu__item selector andrprod-menu-item">' +
                    '<div class="menu__ico">' + BrandIcons.getMiniIconSvg() + '</div>' +
                    '<div class="menu__text andrprod-menu-text">' + BrandIcons.getLogoSvg('andrprod-menu-logo', 'menu') + '</div>' +
                '</li>'
            );

            item.on('hover:enter', function () {
                HubLauncher.open({ view: 'home' });
            });

            menuList.append(item);
        } catch (e) {}
    }

    var SettingsIntegration = {
        init: function () {
            if (!Lampa.SettingsApi) return;
            try {
                Lampa.SettingsApi.addComponent({
                    component: PLUGIN_ID,
                    name: 'ANDRPROD',
                    icon: BrandIcons.getMiniIconSvg()
                });

                Lampa.SettingsApi.addParam({
                    component: PLUGIN_ID,
                    param: {
                        name: STORAGE_KEYS.mode,
                        type: 'select',
                        values: {
                            manual: 'Ручной выбор источника',
                            auto: 'Автоматический (лучший рабочий)'
                        },
                        'default': 'manual'
                    },
                    field: {
                        name: 'Режим запуска в карточке',
                        description: 'Ручной список источников или автопереключение'
                    }
                });

                Lampa.SettingsApi.addParam({
                    component: PLUGIN_ID,
                    param: {
                        name: STORAGE_KEYS.autoSearch,
                        type: 'trigger',
                        'default': true
                    },
                    field: {
                        name: 'Автоматическая проверка источников',
                        description: 'Проверять доступность плагинов и источников в фоне'
                    }
                });

                Lampa.SettingsApi.addParam({
                    component: PLUGIN_ID,
                    param: {
                        name: STORAGE_KEYS.hideBroken,
                        type: 'trigger',
                        'default': false
                    },
                    field: {
                        name: 'Скрывать недоступные источники',
                        description: 'Не показывать источники, не ответившие в пределах тайм-аута'
                    }
                });

                Lampa.SettingsApi.addParam({
                    component: PLUGIN_ID,
                    param: {
                        name: STORAGE_KEYS.timeout,
                        type: 'select',
                        values: {
                            '3000': '3 секунды',
                            '5000': '5 секунд',
                            '8000': '8 секунд',
                            '12000': '12 секунд'
                        },
                        'default': '5000'
                    },
                    field: {
                        name: 'Тайм-аут проверки доступности',
                        description: 'Защита от зависания на телевизорах и приставках'
                    }
                });

                Lampa.SettingsApi.addParam({
                    component: PLUGIN_ID,
                    param: { name: 'andrprod_open_hub', type: 'button' },
                    field: {
                        name: 'Открыть каталог ANDRPROD',
                        description: 'Плагины, источники, фильтры и приоритеты'
                    },
                    onChange: function () {
                        HubLauncher.open({ view: 'home' });
                    }
                });
            } catch (e) {}
        }
    };

    // =========================================================================
    // 12. СТИЛИ ИНТЕРФЕЙСА (ТЁМНАЯ ПРЕМИАЛЬНАЯ ТЕМА ДЛЯ ТВ)
    // =========================================================================
    function injectStyles() {
        if ($('#andrprod-styles').length) return;

        var css = '' +
            '.andrprod-card-btn{background:transparent!important;border:none!important;box-shadow:none!important;padding:0.45em 0.7em!important;display:inline-flex!important;align-items:center;justify-content:center;transition:transform .18s ease,filter .18s ease;}' +
            '.andrprod-card-btn.focus,.andrprod-card-btn:hover{background:transparent!important;box-shadow:none!important;transform:scale(1.08);filter:drop-shadow(0 0 12px rgba(56,189,248,.75));}' +
            '.andrprod-card-btn__logo{height:1.55em;width:auto;display:block;}' +
            '.andrprod-menu-logo{height:1.15em;width:auto;display:block;background:transparent;}' +
            '.andrprod-menu-text{display:flex;align-items:center;}' +

            '.andrprod-hub{padding:1.3em 2em 2em 2em;color:#E2E8F0;}' +
            '.andrprod-hub__header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1em;margin-bottom:1.1em;}' +
            '.andrprod-hub__logo{height:2.05em;width:auto;display:block;}' +
            '.andrprod-hub__stats{font-size:0.88em;color:rgba(226,232,240,.7);margin-top:0.3em;display:flex;align-items:center;flex-wrap:wrap;gap:0.45em;}' +
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

            '.andrprod-section-title{font-size:1.05em;font-weight:700;color:#7DD3FC;margin:0.8em 0 0.7em 0;}' +
            '.andrprod-info-bar{display:flex;justify-content:space-between;margin-bottom:0.9em;font-size:0.88em;color:rgba(226,232,240,.72);}' +

            '.andrprod-source-list{display:flex;flex-direction:column;gap:0.7em;}' +
            '.andrprod-source-card{display:flex;align-items:center;justify-content:space-between;gap:1em;padding:1em 1.25em;border-radius:0.9em;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.06);transition:background .15s ease,transform .15s ease,box-shadow .15s ease;}' +
            '.andrprod-source-card.is-disabled{opacity:.5;}' +
            '.andrprod-source-card.focus{background:rgba(14,165,233,.22);transform:scale(1.01);box-shadow:0 0 0 2px #38BDF8;}' +
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
            '.andrprod-star{color:#FBBF24;}' +
            '.andrprod-badge{padding:0.3em 0.8em;border-radius:999px;font-size:0.8em;font-weight:700;white-space:nowrap;}' +
            '.andrprod-badge.is-on{background:rgba(34,197,94,.18);color:#4ADE80;}' +
            '.andrprod-badge.is-off{background:rgba(148,163,184,.2);color:#CBD5E1;}' +

            '.andrprod-media-grid{display:flex;flex-wrap:wrap;gap:1em;}' +
            '.andrprod-media-card{width:10.5em;border-radius:0.75em;padding:0.4em;background:rgba(255,255,255,.04);transition:transform .15s ease,box-shadow .15s ease;}' +
            '.andrprod-media-card.focus{transform:scale(1.05);box-shadow:0 0 0 2px #38BDF8;background:rgba(14,165,233,.16);}' +
            '.andrprod-media-card__poster{width:100%;height:14.5em;border-radius:0.55em;background-color:rgba(255,255,255,.08);background-size:cover;background-position:center;position:relative;}' +
            '.andrprod-media-card__rate{position:absolute;top:0.45em;right:0.45em;padding:0.15em 0.45em;border-radius:0.35em;background:rgba(15,23,42,.85);color:#38BDF8;font-size:0.78em;font-weight:700;}' +
            '.andrprod-media-card__title{margin-top:0.5em;font-size:0.88em;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
            '.andrprod-media-card__year{font-size:0.76em;color:rgba(226,232,240,.58);margin-top:0.15em;}' +

            '.andrprod-settings-list{display:flex;flex-direction:column;gap:0.65em;}' +
            '.andrprod-setting-row{display:flex;align-items:center;justify-content:space-between;padding:1em 1.25em;border-radius:0.85em;background:rgba(255,255,255,.05);}' +
            '.andrprod-setting-row.focus{background:rgba(14,165,233,.24);box-shadow:0 0 0 2px #38BDF8;}' +
            '.andrprod-setting-row__title{font-size:1em;font-weight:600;}' +
            '.andrprod-setting-row__desc{font-size:0.82em;color:rgba(226,232,240,.62);margin-top:0.2em;}' +
            '.andrprod-setting-row__val{font-size:0.92em;font-weight:700;color:#38BDF8;margin-left:1.5em;white-space:nowrap;}' +

            '.andrprod-empty,.andrprod-loading{padding:2.2em 1.5em;text-align:center;background:rgba(255,255,255,.04);border-radius:0.9em;}' +
            '.andrprod-empty__title{font-size:1.1em;font-weight:600;margin-bottom:0.45em;}' +
            '.andrprod-empty__desc{font-size:0.9em;color:rgba(226,232,240,.68);max-width:44em;margin:0 auto;}';

        $('head').append('<style id="andrprod-styles">' + css + '</style>');
    }

    // =========================================================================
    // 13. ПУБЛИЧНЫЙ API (window.ANDRPROD_API)
    // =========================================================================
    window.ANDRPROD_API = {
        version: PLUGIN_VERSION,
        registerAdapter: function (adapter) {
            return SourceRegistry.registerAdapter(adapter);
        },
        getPlugins: function () {
            return SourceRegistry.getPlugins();
        },
        getPluginSources: function (pluginId) {
            return SourceRegistry.getPluginSources(pluginId);
        },
        getSources: function () {
            return SourceRegistry.getAllSources();
        },
        getFilteredSources: function (customFilters) {
            return FilterEngine.apply(SourceRegistry.getAllSources(), customFilters || StorageManager.getFilters());
        },
        getFilters: function () {
            return StorageManager.getFilters();
        },
        setFilters: function (patch) {
            return StorageManager.setFilters(patch);
        },
        rescan: function (onDone) {
            SourceRegistry.resetAndScan();
            SourceRegistry.discoverAllPluginSources(null, onDone);
            return SourceRegistry.getPlugins();
        },
        openHub: function (view) {
            HubLauncher.open({ view: view || 'home' });
        },
        openPlugin: function (pluginId) {
            HubLauncher.open({ view: 'plugin', pluginId: pluginId });
        }
    };

    // =========================================================================
    // 14. ИНИЦИАЛИЗАЦИЯ ПЛАГИНА
    // =========================================================================
    function startPlugin() {
        try {
            injectStyles();
            Lampa.Component.add(HUB_COMPONENT, AndrprodHubComponent);
            SourceRegistry.resetAndScan();
            SourceRegistry.discoverAllPluginSources();
            CardIntegration.init();
            SettingsIntegration.init();
            addSidebarMenuItem();
        } catch (err) {
            // Защита от конфликтов и падения Lampa
        }
    }

    if (window.appready) {
        startPlugin();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') startPlugin();
        });
    }
})();
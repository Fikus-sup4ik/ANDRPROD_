(function () {
    'use strict';

    /**
     * ANDRPROD — Единый центр управления онлайн-источниками для Lampa
     * Версия: 1.0.0
     * Совместимость: Lampa 1.x / 2.x / 3.x, Android TV, Tizen, webOS, Desktop WebView (ES5)
     *
     * Архитектура:
     * 1. StorageManager — безопасное хранение всех настроек в Lampa.Storage.
     * 2. SourceRegistry — обнаружение установленных плагинов (Lampa.Storage 'plugins',
     *    Lampa.Manifest.plugins) и кнопок просмотра в карточке фильма/сериала,
     *    плюс публичный API для подключения прямых потоковых адаптеров (window.ANDRPROD_API).
     * 3. HealthChecker — асинхронная проверка доступности источников через Lampa.Reguest
     *    с тайм-аутами, кешированием и защитой от зависания UI.
     * 4. CardIntegration — интеграция прозрачной кнопки ANDRPROD в карточку фильма/сериала,
     *    ручной/автоматический режим запуска и автоматический fallback на следующий рабочий источник.
     * 5. HubComponent — полноценный экран ANDRPROD с разделами:
     *    «Все источники», «Фильмы», «Сериалы», «Избранные источники», «Настройки»
     *    и полным управлением пультом ТВ (Lampa.Controller).
     * 6. SettingsIntegration — нативный раздел настроек в Lampa.SettingsApi.
     */

    if (window.andrprod_plugin_loaded) return;
    window.andrprod_plugin_loaded = true;

    var PLUGIN_ID = 'andrprod';
    var PLUGIN_VERSION = '1.0.0';
    var HUB_COMPONENT = 'andrprod_hub';

    // =========================================================================
    // 1. ПРОЗРАЧНЫЙ ЛОГОТИП ANDRPROD (SVG, голубовато-синий, без фона и рамки)
    // =========================================================================
    function getLogoSvg(className, uid) {
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
    }

    function getMiniIconSvg() {
        return (
            '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none">' +
                '<path d="M4 18L10.5 5H13.5L20 18H16.8L15.4 15H8.6L7.2 18H4ZM9.7 12.4H14.3L12 7.5L9.7 12.4Z" fill="#38BDF8"/>' +
            '</svg>'
        );
    }

    // =========================================================================
    // 2. ХРАНИЛИЩЕ НАСТРОЕК (Lampa.Storage)
    // =========================================================================
    var STORAGE_KEYS = {
        mode: 'andrprod_mode',                     // 'manual' | 'auto'
        autoSearch: 'andrprod_auto_search',        // true | false
        hideBroken: 'andrprod_hide_broken',        // true | false
        timeout: 'andrprod_timeout_ms',            // 3000 | 5000 | 8000 | 12000
        disabled: 'andrprod_disabled_sources',     // { id: true }
        favorites: 'andrprod_favorite_sources',    // { id: true }
        priorities: 'andrprod_source_priorities'   // [id1, id2, ...]
    };

    var Config = {
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
            } catch (e) {
                // ignore storage write errors
            }
        },
        getMode: function () {
            return Config.get(STORAGE_KEYS.mode, 'manual');
        },
        setMode: function (mode) {
            Config.set(STORAGE_KEYS.mode, mode === 'auto' ? 'auto' : 'manual');
        },
        isAutoSearch: function () {
            var v = Config.get(STORAGE_KEYS.autoSearch, true);
            return v === true || v === 'true';
        },
        setAutoSearch: function (flag) {
            Config.set(STORAGE_KEYS.autoSearch, !!flag);
        },
        isHideBroken: function () {
            var v = Config.get(STORAGE_KEYS.hideBroken, false);
            return v === true || v === 'true';
        },
        setHideBroken: function (flag) {
            Config.set(STORAGE_KEYS.hideBroken, !!flag);
        },
        getTimeout: function () {
            var t = parseInt(Config.get(STORAGE_KEYS.timeout, 5000), 10);
            if (isNaN(t) || t < 2000 || t > 20000) return 5000;
            return t;
        },
        setTimeoutMs: function (ms) {
            Config.set(STORAGE_KEYS.timeout, parseInt(ms, 10) || 5000);
        },
        getDisabledMap: function () {
            var m = Config.get(STORAGE_KEYS.disabled, {});
            return m && typeof m === 'object' ? m : {};
        },
        isEnabled: function (id) {
            var m = Config.getDisabledMap();
            return !m[id];
        },
        setEnabled: function (id, enabled) {
            var m = Config.getDisabledMap();
            if (enabled) delete m[id];
            else m[id] = true;
            Config.set(STORAGE_KEYS.disabled, m);
        },
        getFavoritesMap: function () {
            var m = Config.get(STORAGE_KEYS.favorites, {});
            return m && typeof m === 'object' ? m : {};
        },
        isFavorite: function (id) {
            var m = Config.getFavoritesMap();
            return !!m[id];
        },
        toggleFavorite: function (id) {
            var m = Config.getFavoritesMap();
            if (m[id]) delete m[id];
            else m[id] = true;
            Config.set(STORAGE_KEYS.favorites, m);
            return !!m[id];
        },
        getPriorities: function () {
            var arr = Config.get(STORAGE_KEYS.priorities, []);
            return Object.prototype.toString.call(arr) === '[object Array]' ? arr : [];
        },
        setPriorities: function (arr) {
            Config.set(STORAGE_KEYS.priorities, arr || []);
        },
        movePriority: function (id, direction) {
            var list = SourceRegistry.getSortedSources();
            var ids = [];
            var i;
            for (i = 0; i < list.length; i++) ids.push(list[i].id);
            var idx = ids.indexOf(id);
            if (idx === -1) return false;
            var target = idx + direction;
            if (target < 0 || target >= ids.length) return false;
            var tmp = ids[idx];
            ids[idx] = ids[target];
            ids[target] = tmp;
            Config.setPriorities(ids);
            return true;
        }
    };

    // =========================================================================
    // 3. БАЗА ИЗВЕСТНЫХ СИГНАТУР ОНЛАЙН-ПЛАГИНОВ LAMPA
    // =========================================================================
    // Используется только для распознавания уже установленных у пользователя
    // плагинов (без копирования их кода и без подмены их настроек).
    var KNOWN_SIGNATURES = [
        {
            id: 'lumio',
            name: 'Lumio',
            patterns: ['lumio'],
            buttonHints: ['lumio'],
            qualityRank: 95,
            type: 'plugin_button',
            description: 'Онлайн-источник Lumio (интеграция через кнопку карточки / адаптер)'
        },
        {
            id: 'alpaca',
            name: 'Alpaca',
            patterns: ['alpaca'],
            buttonHints: ['alpaca'],
            qualityRank: 92,
            type: 'plugin_button',
            description: 'Онлайн-источник Alpaca (интеграция через кнопку карточки / адаптер)'
        },
        {
            id: 'lampac',
            name: 'Lampac Online',
            patterns: ['lampac', '/online.js', 'online_prestige', 'lampa.mx'],
            buttonHints: ['online_prestige', 'lampac', 'онлайн', 'online'],
            qualityRank: 90,
            type: 'plugin_button',
            description: 'Серверный балансировщик Lampac / Online Prestige'
        },
        {
            id: 'online_mod',
            name: 'Online Mod',
            patterns: ['online_mod', 'nb557'],
            buttonHints: ['online_mod', 'онлайн мод', 'online mod'],
            qualityRank: 88,
            type: 'plugin_button',
            description: 'Плагин Online Mod (nb557)'
        },
        {
            id: 'bwa',
            name: 'BWA',
            patterns: ['bwa', 'rc.bwa'],
            buttonHints: ['bwa'],
            qualityRank: 85,
            type: 'plugin_button',
            description: 'Онлайн-источник BWA'
        },
        {
            id: 'showy',
            name: 'Showy',
            patterns: ['showy'],
            buttonHints: ['showy'],
            qualityRank: 84,
            type: 'plugin_button',
            description: 'Онлайн-источник Showy'
        },
        {
            id: 'rezka',
            name: 'HDRezka',
            patterns: ['rezka', 'hdrezka'],
            buttonHints: ['rezka', 'резка'],
            qualityRank: 82,
            type: 'plugin_button',
            description: 'Плагин HDRezka'
        },
        {
            id: 'kinopub',
            name: 'KinoPub',
            patterns: ['kinopub', 'kpub'],
            buttonHints: ['kinopub', 'кинопаб'],
            qualityRank: 86,
            type: 'plugin_button',
            description: 'Плагин KinoPub'
        },
        {
            id: 'filmix',
            name: 'Filmix',
            patterns: ['filmix'],
            buttonHints: ['filmix', 'филмикс'],
            qualityRank: 80,
            type: 'plugin_button',
            description: 'Плагин Filmix'
        },
        {
            id: 'kodik',
            name: 'Kodik',
            patterns: ['kodik'],
            buttonHints: ['kodik', 'кодик'],
            qualityRank: 78,
            type: 'plugin_button',
            description: 'Плагин Kodik (аниме и сериалы)'
        },
        {
            id: 'torrents',
            name: 'Торренты (TorrServer)',
            patterns: ['torrserver', 'jacred', 'torrent'],
            buttonHints: ['view--torrent', 'торрент', 'torrent'],
            qualityRank: 75,
            type: 'builtin_button',
            description: 'Встроенный просмотр через торренты Lampa'
        }
    ];

    // Игнорируемые системные кнопки карточки, которые НЕ являются источниками просмотра
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
    // 4. РЕЕСТР ИСТОЧНИКОВ И АДАПТЕРОВ
    // =========================================================================
    var SourceRegistry = {
        sources: {},          // id -> source metadata
        customAdapters: {},   // id -> { id, name, qualityRank, check?, search?, open? }
        healthCache: {},      // id -> { status: 'online'|'offline'|'button_only'|'unsupported'|'checking', latency, checkedAt, message }

        resetAndScan: function () {
            var self = this;
            var discovered = {};

            // 1. Сначала регистрируем пользовательские / внешние API-адаптеры
            var adapterId;
            for (adapterId in self.customAdapters) {
                if (!self.customAdapters.hasOwnProperty(adapterId)) continue;
                var ad = self.customAdapters[adapterId];
                discovered[ad.id] = {
                    id: ad.id,
                    name: ad.name || ad.id,
                    url: ad.url || '',
                    qualityRank: ad.qualityRank || 90,
                    integrationType: 'direct_adapter',
                    description: ad.description || 'Подключён прямой адаптер API',
                    adapter: ad,
                    detectedVia: 'API-адаптер'
                };
            }

            // 2. Сканируем установленные плагины из Lampa.Storage ('plugins')
            var installedPlugins = [];
            try {
                var stored = Lampa.Storage.get('plugins', []);
                if (Object.prototype.toString.call(stored) === '[object Array]') {
                    installedPlugins = installedPlugins.concat(stored);
                }
            } catch (e1) {}

            // 3. Также проверяем Lampa.Manifest.plugins (если доступно)
            try {
                if (Lampa.Manifest && Object.prototype.toString.call(Lampa.Manifest.plugins) === '[object Array]') {
                    installedPlugins = installedPlugins.concat(Lampa.Manifest.plugins);
                }
            } catch (e2) {}

            var i, j, p, pUrl, pName, lowerUrl, lowerName, matchedSig;
            for (i = 0; i < installedPlugins.length; i++) {
                p = installedPlugins[i];
                if (!p) continue;
                if (typeof p === 'string') {
                    pUrl = p;
                    pName = '';
                } else {
                    if (p.status === 0) continue; // отключён в самой Lampa
                    pUrl = p.url || p.src || '';
                    pName = p.name || p.title || '';
                }
                if (!pUrl && !pName) continue;

                lowerUrl = String(pUrl).toLowerCase();
                lowerName = String(pName).toLowerCase();

                // Пропускаем сам ANDRPROD
                if (lowerUrl.indexOf('andrprod') !== -1 || lowerName.indexOf('andrprod') !== -1) {
                    continue;
                }

                matchedSig = null;
                for (j = 0; j < KNOWN_SIGNATURES.length; j++) {
                    var sig = KNOWN_SIGNATURES[j];
                    var k;
                    for (k = 0; k < sig.patterns.length; k++) {
                        if (lowerUrl.indexOf(sig.patterns[k]) !== -1 || lowerName.indexOf(sig.patterns[k]) !== -1) {
                            matchedSig = sig;
                            break;
                        }
                    }
                    if (matchedSig) break;
                }

                if (matchedSig) {
                    if (!discovered[matchedSig.id]) {
                        discovered[matchedSig.id] = {
                            id: matchedSig.id,
                            name: matchedSig.name,
                            url: pUrl,
                            qualityRank: matchedSig.qualityRank,
                            integrationType: 'card_delegation',
                            description: matchedSig.description,
                            buttonHints: matchedSig.buttonHints,
                            detectedVia: 'Установленный плагин'
                        };
                    } else if (pUrl && !discovered[matchedSig.id].url) {
                        discovered[matchedSig.id].url = pUrl;
                    }
                } else if (self._looksLikeOnlinePlugin(lowerUrl, lowerName)) {
                    var dynId = self._makeSafeId(pName || pUrl);
                    if (!discovered[dynId]) {
                        discovered[dynId] = {
                            id: dynId,
                            name: pName || self._extractPluginLabel(pUrl),
                            url: pUrl,
                            qualityRank: 70,
                            integrationType: 'card_delegation',
                            description: 'Стороннее расширение Lampa (запуск через кнопку карточки)',
                            buttonHints: [dynId, (pName || '').toLowerCase()],
                            detectedVia: 'Автообнаружение плагина'
                        };
                    }
                }
            }

            // 4. Проверяем наличие встроенных торрентов (если в Lampa включён парсер)
            try {
                var parserUse = Lampa.Storage.get('parser_use', false);
                if (parserUse && !discovered['torrents']) {
                    discovered['torrents'] = {
                        id: 'torrents',
                        name: 'Торренты (TorrServer)',
                        url: '',
                        qualityRank: 75,
                        integrationType: 'card_delegation',
                        description: 'Встроенный источник торрентов Lampa',
                        buttonHints: ['view--torrent', 'торрент', 'torrent'],
                        detectedVia: 'Встроенный модуль Lampa'
                    };
                }
            } catch (e3) {}

            // Сохраняем ранее обнаруженные динамические источники из карточек
            var oldId;
            for (oldId in self.sources) {
                if (self.sources.hasOwnProperty(oldId) && self.sources[oldId].detectedVia === 'Кнопка карточки' && !discovered[oldId]) {
                    discovered[oldId] = self.sources[oldId];
                }
            }

            self.sources = discovered;
            return self.getSortedSources();
        },

        registerCardButtonSource: function (btnInfo) {
            if (!btnInfo || !btnInfo.id) return null;
            if (!this.sources[btnInfo.id]) {
                this.sources[btnInfo.id] = {
                    id: btnInfo.id,
                    name: btnInfo.name,
                    url: '',
                    qualityRank: btnInfo.qualityRank || 72,
                    integrationType: 'card_delegation',
                    description: 'Обнаружен по кнопке просмотра в карточке',
                    buttonHints: [btnInfo.id, btnInfo.name.toLowerCase()],
                    detectedVia: 'Кнопка карточки'
                };
            }
            return this.sources[btnInfo.id];
        },

        registerAdapter: function (adapter) {
            if (!adapter || !adapter.id) return false;
            this.customAdapters[adapter.id] = adapter;
            this.resetAndScan();
            return true;
        },

        getSortedSources: function (options) {
            options = options || {};
            var list = [];
            var id;
            for (id in this.sources) {
                if (this.sources.hasOwnProperty(id)) {
                    list.push(this.sources[id]);
                }
            }

            var priorities = Config.getPriorities();
            var self = this;

            list.sort(function (a, b) {
                // 1. Пользовательский приоритет (если задан)
                var pa = priorities.indexOf(a.id);
                var pb = priorities.indexOf(b.id);
                if (pa !== -1 && pb !== -1) return pa - pb;
                if (pa !== -1) return -1;
                if (pb !== -1) return 1;

                // 2. Избранные выше остальных
                var fa = Config.isFavorite(a.id) ? 1 : 0;
                var fb = Config.isFavorite(b.id) ? 1 : 0;
                if (fa !== fb) return fb - fa;

                // 3. Доступность (online > button_only > unknown > offline)
                var sa = self._statusWeight(self.getHealth(a.id).status);
                var sb = self._statusWeight(self.getHealth(b.id).status);
                if (sa !== sb) return sb - sa;

                // 4. Ранг качества
                return (b.qualityRank || 0) - (a.qualityRank || 0);
            });

            if (options.onlyEnabled) {
                var filtered = [];
                var i;
                for (i = 0; i < list.length; i++) {
                    if (Config.isEnabled(list[i].id)) filtered.push(list[i]);
                }
                list = filtered;
            }

            if (options.onlyFavorites) {
                var favs = [];
                var f;
                for (f = 0; f < list.length; f++) {
                    if (Config.isFavorite(list[f].id)) favs.push(list[f]);
                }
                list = favs;
            }

            if (options.hideBroken || (options.respectHideBroken && Config.isHideBroken())) {
                var healthy = [];
                var h;
                for (h = 0; h < list.length; h++) {
                    var st = self.getHealth(list[h].id).status;
                    if (st !== 'offline' && st !== 'unsupported') {
                        healthy.push(list[h]);
                    }
                }
                list = healthy;
            }

            return list;
        },

        getHealth: function (id) {
            if (this.healthCache[id]) return this.healthCache[id];
            var src = this.sources[id];
            if (!src) return { status: 'unsupported', latency: 0, message: 'Источник не найден' };
            if (src.integrationType === 'direct_adapter') {
                return { status: 'online', latency: 0, message: 'Прямой адаптер готов' };
            }
            if (!src.url) {
                return { status: 'button_only', latency: 0, message: 'Режим делегирования кнопки' };
            }
            return { status: 'unknown', latency: 0, message: 'Не проверен' };
        },

        _statusWeight: function (st) {
            if (st === 'online') return 4;
            if (st === 'button_only') return 3;
            if (st === 'checking' || st === 'unknown') return 2;
            if (st === 'unsupported') return 1;
            return 0; // offline
        },

        _looksLikeOnlinePlugin: function (lowerUrl, lowerName) {
            var keywords = ['online', 'video', 'watch', 'stream', 'cinema', 'kino', 'film', 'movie', 'balancer', 'bwa', 'mod', 'tv', 'hd'];
            var i;
            for (i = 0; i < keywords.length; i++) {
                if (lowerUrl.indexOf(keywords[i]) !== -1 || lowerName.indexOf(keywords[i]) !== -1) {
                    return true;
                }
            }
            return false;
        },

        _extractPluginLabel: function (url) {
            try {
                var clean = String(url).split('?')[0].split('#')[0];
                var parts = clean.split('/');
                var file = parts[parts.length - 1] || parts[parts.length - 2] || 'Plugin';
                file = file.replace(/\.js$/i, '').replace(/[_-]+/g, ' ');
                if (!file) return 'Онлайн-плагин';
                return file.charAt(0).toUpperCase() + file.slice(1);
            } catch (e) {
                return 'Онлайн-плагин';
            }
        },

        _makeSafeId: function (str) {
            return String(str || 'src')
                .toLowerCase()
                .replace(/^https?:\/\//, '')
                .replace(/[^a-z0-9а-яё]+/gi, '_')
                .replace(/^_+|_+$/g, '')
                .slice(0, 32) || 'src_custom';
        }
    };

    // =========================================================================
    // 5. ПРОВЕРКА ДОСТУПНОСТИ ИСТОЧНИКОВ (HealthChecker с тайм-аутами)
    // =========================================================================
    var HealthChecker = {
        CACHE_TTL_MS: 120000, // 2 минуты

        checkSource: function (source, force, callback) {
            var self = this;
            if (!source) {
                if (callback) callback({ status: 'unsupported', latency: 0, message: 'Нет данных' });
                return;
            }

            var cached = SourceRegistry.healthCache[source.id];
            var now = Date.now();
            if (!force && cached && cached.checkedAt && (now - cached.checkedAt) < self.CACHE_TTL_MS) {
                if (callback) callback(cached);
                return;
            }

            // Если у источника подключён прямой адаптер со своим методом check()
            if (source.integrationType === 'direct_adapter' && source.adapter && typeof source.adapter.check === 'function') {
                var startAd = Date.now();
                var finishedAd = false;
                var timerAd = setTimeout(function () {
                    if (finishedAd) return;
                    finishedAd = true;
                    var resT = { status: 'offline', latency: Config.getTimeout(), checkedAt: Date.now(), message: 'Тайм-аут адаптера' };
                    SourceRegistry.healthCache[source.id] = resT;
                    if (callback) callback(resT);
                }, Config.getTimeout());

                try {
                    source.adapter.check(function (ok, msg) {
                        if (finishedAd) return;
                        finishedAd = true;
                        clearTimeout(timerAd);
                        var res = {
                            status: ok ? 'online' : 'offline',
                            latency: Date.now() - startAd,
                            checkedAt: Date.now(),
                            message: msg || (ok ? 'Доступен' : 'Не отвечает')
                        };
                        SourceRegistry.healthCache[source.id] = res;
                        if (callback) callback(res);
                    });
                } catch (errAd) {
                    if (!finishedAd) {
                        finishedAd = true;
                        clearTimeout(timerAd);
                        var resErr = { status: 'offline', latency: 0, checkedAt: Date.now(), message: 'Ошибка адаптера' };
                        SourceRegistry.healthCache[source.id] = resErr;
                        if (callback) callback(resErr);
                    }
                }
                return;
            }

            // Если URL скрипта отсутствует (встроенная кнопка без внешнего адреса)
            if (!source.url || source.url.indexOf('http') !== 0) {
                var btnRes = {
                    status: 'button_only',
                    latency: 0,
                    checkedAt: Date.now(),
                    message: 'Запуск через кнопку плагина'
                };
                SourceRegistry.healthCache[source.id] = btnRes;
                if (callback) callback(btnRes);
                return;
            }

            // Сетевая проверка доступности URL плагина через Lampa.Reguest
            SourceRegistry.healthCache[source.id] = {
                status: 'checking',
                latency: 0,
                checkedAt: 0,
                message: 'Проверка...'
            };

            var start = Date.now();
            var done = false;
            var timeoutMs = Config.getTimeout();
            var net = null;

            try {
                net = new Lampa.Reguest();
                net.timeout(timeoutMs);
            } catch (eNet) {
                var fallbackRes = { status: 'button_only', latency: 0, checkedAt: Date.now(), message: 'Локальная проверка недоступна' };
                SourceRegistry.healthCache[source.id] = fallbackRes;
                if (callback) callback(fallbackRes);
                return;
            }

            var guardTimer = setTimeout(function () {
                if (done) return;
                done = true;
                try { net.clear(); } catch (eC) {}
                var resTimeout = {
                    status: 'offline',
                    latency: timeoutMs,
                    checkedAt: Date.now(),
                    message: 'Тайм-аут (' + Math.round(timeoutMs / 1000) + ' с)'
                };
                SourceRegistry.healthCache[source.id] = resTimeout;
                if (callback) callback(resTimeout);
            }, timeoutMs + 300);

            net.silent(
                source.url,
                function () {
                    if (done) return;
                    done = true;
                    clearTimeout(guardTimer);
                    var resOk = {
                        status: 'online',
                        latency: Date.now() - start,
                        checkedAt: Date.now(),
                        message: 'Доступен (' + (Date.now() - start) + ' мс)'
                    };
                    SourceRegistry.healthCache[source.id] = resOk;
                    if (callback) callback(resOk);
                },
                function () {
                    if (done) return;
                    done = true;
                    clearTimeout(guardTimer);
                    var resFail = {
                        status: 'offline',
                        latency: Date.now() - start,
                        checkedAt: Date.now(),
                        message: 'Сервер плагина недоступен'
                    };
                    SourceRegistry.healthCache[source.id] = resFail;
                    if (callback) callback(resFail);
                },
                false,
                { dataType: 'text' }
            );
        },

        checkAll: function (force, onUpdate, onComplete) {
            var sources = SourceRegistry.getSortedSources();
            var total = sources.length;
            if (!total) {
                if (onComplete) onComplete();
                return;
            }
            var finished = 0;
            var i;
            for (i = 0; i < total; i++) {
                (function (src) {
                    HealthChecker.checkSource(src, force, function (res) {
                        finished++;
                        if (onUpdate) onUpdate(src, res);
                        if (finished >= total && onComplete) onComplete();
                    });
                })(sources[i]);
            }
        }
    };

    // =========================================================================
    // 6. ИНТЕГРАЦИЯ С КАРТОЧКОЙ ФИЛЬМА / СЕРИАЛА (CardIntegration)
    // =========================================================================
    var CardIntegration = {
        init: function () {
            Lampa.Listener.follow('full', function (e) {
                if (e.type === 'complite') {
                    try {
                        CardIntegration.attachToCard(e);
                    } catch (err) {
                        // Не ломаем стандартную карточку Lampa ни при каких ошибках
                    }
                }
            });
        },

        attachToCard: function (event) {
            var render = event.object && event.object.activity ? event.object.activity.render() : null;
            if (!render || !render.length) return;

            var buttonsContainer = render.find('.full-start-new__buttons');
            if (!buttonsContainer.length) {
                buttonsContainer = render.find('.full-start__buttons');
            }
            if (!buttonsContainer.length) return;

            // Удаляем дубликат, если карточка перерисовалась
            buttonsContainer.find('.andrprod-card-btn').remove();

            var movie = (event.data && event.data.movie) ? event.data.movie : (event.object && event.object.card ? event.object.card : {});

            // Создаём кнопку ANDRPROD с прозрачным логотипом без рамки и подложки
            var btn = $(
                '<div class="full-start__button selector andrprod-card-btn" data-andrprod="1">' +
                    getLogoSvg('andrprod-card-btn__logo', 'card_' + (movie.id || '0')) +
                '</div>'
            );

            // Вставляем кнопку первой для быстрого доступа с пульта
            buttonsContainer.prepend(btn);

            // Фоновая проверка доступности источников при открытии карточки (если включено)
            if (Config.isAutoSearch()) {
                setTimeout(function () {
                    CardIntegration.collectCardButtons(buttonsContainer);
                    HealthChecker.checkAll(false);
                }, 450);
            }

            btn.on('hover:enter', function () {
                CardIntegration.openSourceCenterForMovie(movie, buttonsContainer);
            });
        },

        /**
         * Находит реальные кнопки онлайн-просмотра, добавленные другими
         * установленными плагинами в текущую карточку фильма/сериала.
         */
        collectCardButtons: function (buttonsContainer) {
            var found = [];
            if (!buttonsContainer || !buttonsContainer.length) return found;

            var allBtns = buttonsContainer.find('.full-start__button');
            allBtns.each(function () {
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

                // Пропускаем кнопки, не связанные с просмотром (закладки, трейлеры, реакции)
                if (
                    lowerLabel.indexOf('трейлер') !== -1 ||
                    lowerLabel.indexOf('trailer') !== -1 ||
                    lowerLabel.indexOf('закладк') !== -1 ||
                    lowerLabel.indexOf('подпис') !== -1
                ) {
                    return;
                }

                var matchedId = CardIntegration._matchButtonToKnownId(lowerLabel, lowerCls);
                if (!matchedId) {
                    matchedId = SourceRegistry._makeSafeId(label);
                }

                SourceRegistry.registerCardButtonSource({
                    id: matchedId,
                    name: label,
                    qualityRank: 75
                });

                found.push({
                    id: matchedId,
                    name: label,
                    element: el
                });
            });

            return found;
        },

        _matchButtonToKnownId: function (lowerLabel, lowerCls) {
            var i, j, sig;
            for (i = 0; i < KNOWN_SIGNATURES.length; i++) {
                sig = KNOWN_SIGNATURES[i];
                for (j = 0; j < sig.buttonHints.length; j++) {
                    var hint = sig.buttonHints[j];
                    if (lowerLabel.indexOf(hint) !== -1 || lowerCls.indexOf(hint) !== -1) {
                        return sig.id;
                    }
                }
            }
            return null;
        },

        openSourceCenterForMovie: function (movie, buttonsContainer) {
            SourceRegistry.resetAndScan();
            var cardButtons = CardIntegration.collectCardButtons(buttonsContainer);
            var buttonMap = {};
            var i;
            for (i = 0; i < cardButtons.length; i++) {
                buttonMap[cardButtons[i].id] = cardButtons[i];
            }

            var sources = SourceRegistry.getSortedSources({
                onlyEnabled: true,
                respectHideBroken: true
            });

            if (!sources.length) {
                Lampa.Noty.show('ANDRPROD: Нет активных источников. Проверьте раздел Настройки → ANDRPROD.');
                return;
            }

            // Автоматический режим: выбираем первый доступный источник с fallback-цепочкой
            if (Config.getMode() === 'auto') {
                CardIntegration.launchWithFallback(sources, 0, movie, buttonMap);
                return;
            }

            // Ручной режим: показываем единый список источников в стиле Lampa
            var selectItems = [];
            for (i = 0; i < sources.length; i++) {
                (function (src) {
                    var health = SourceRegistry.getHealth(src.id);
                    var hasBtn = !!buttonMap[src.id];
                    var hasDirect = src.integrationType === 'direct_adapter';
                    var statusBadge = CardIntegration._formatStatusText(health, hasBtn, hasDirect);
                    var favStar = Config.isFavorite(src.id) ? '★ ' : '';

                    selectItems.push({
                        title: favStar + src.name,
                        subtitle: statusBadge,
                        source: src,
                        canLaunch: hasBtn || hasDirect
                    });
                })(sources[i]);
            }

            // Добавляем пункт быстрого перехода в центр ANDRPROD
            selectItems.push({
                title: '⚙ Управление источниками ANDRPROD',
                subtitle: 'Приоритеты, избранное, проверка доступности и настройки',
                openHub: true
            });

            var movieTitle = movie.title || movie.name || 'Выбор источника';
            Lampa.Select.show({
                title: 'ANDRPROD — ' + movieTitle,
                items: selectItems,
                onSelect: function (item) {
                    if (item.openHub) {
                        HubLauncher.open('sources');
                        return;
                    }
                    if (!item.canLaunch) {
                        Lampa.Noty.show(
                            'ANDRPROD: Источник «' + item.source.name + '» не добавил кнопку в эту карточку и не имеет подключённого API-адаптера.'
                        );
                        return;
                    }
                    // Запускаем выбранный источник, при ошибке переходим на резервный
                    var remaining = [item.source];
                    var r;
                    for (r = 0; r < sources.length; r++) {
                        if (sources[r].id !== item.source.id) remaining.push(sources[r]);
                    }
                    CardIntegration.launchWithFallback(remaining, 0, movie, buttonMap);
                },
                onBack: function () {
                    Lampa.Controller.toggle('full_start');
                }
            });
        },

        launchWithFallback: function (sources, index, movie, buttonMap) {
            if (index >= sources.length) {
                Lampa.Noty.show('ANDRPROD: Ни один из доступных источников не смог открыть этот фильм/сериал.');
                return;
            }

            var src = sources[index];
            var btnRecord = buttonMap[src.id];

            // Вариант 1: Прямой API-адаптер (реальный поиск потоков)
            if (src.integrationType === 'direct_adapter' && src.adapter && typeof src.adapter.open === 'function') {
                try {
                    src.adapter.open(movie, function (success) {
                        if (!success) {
                            Lampa.Noty.show('ANDRPROD: ' + src.name + ' не вернул результат, переключение...');
                            CardIntegration.launchWithFallback(sources, index + 1, movie, buttonMap);
                        }
                    });
                    return;
                } catch (eAd) {
                    CardIntegration.launchWithFallback(sources, index + 1, movie, buttonMap);
                    return;
                }
            }

            // Вариант 2: Делегирование реальной кнопке установленного плагина
            if (btnRecord && btnRecord.element && btnRecord.element.length) {
                try {
                    Lampa.Noty.show('ANDRPROD → ' + src.name);
                    btnRecord.element.trigger('hover:enter');
                    return;
                } catch (eBtn) {
                    CardIntegration.launchWithFallback(sources, index + 1, movie, buttonMap);
                    return;
                }
            }

            // Источник не доступен для этой карточки — переходим к следующему
            CardIntegration.launchWithFallback(sources, index + 1, movie, buttonMap);
        },

        _formatStatusText: function (health, hasBtn, hasDirect) {
            if (hasDirect) {
                return '● Прямой API-адаптер' + (health.latency ? ' • ' + health.latency + ' мс' : '');
            }
            if (hasBtn) {
                if (health.status === 'online') return '● Доступен • Кнопка плагина (' + health.latency + ' мс)';
                if (health.status === 'offline') return '● Предупреждение: сервер не ответил • Кнопка плагина';
                return '● Готов к запуску • Кнопка плагина';
            }
            return '○ Не поддерживается в карточке (требуется адаптер или установка плагина)';
        }
    };

    // =========================================================================
    // 7. ГЛАВНЫЙ ИНТЕРФЕЙС ANDRPROD (HubComponent с управлением пультом ТВ)
    // =========================================================================
    var HubLauncher = {
        open: function (initialTab) {
            Lampa.Activity.push({
                url: '',
                title: 'ANDRPROD',
                component: HUB_COMPONENT,
                tab: initialTab || 'sources',
                page: 1
            });
        }
    };

    function AndrprodHubComponent(object) {
        var self = this;
        var currentTab = (object && object.tab) ? object.tab : 'sources';
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var html = $('<div class="andrprod-hub"></div>');
        var headerEl = null;
        var tabsEl = null;
        var bodyEl = null;
        var lastFocused = null;
        var activeControllerArea = 'tabs'; // 'tabs' | 'body'
        var mediaCache = { movie: null, tv: null };
        var isDestroyed = false;

        var TABS = [
            { id: 'sources', title: 'Все источники' },
            { id: 'movies', title: 'Фильмы' },
            { id: 'series', title: 'Сериалы' },
            { id: 'favorites', title: 'Избранные источники' },
            { id: 'settings', title: 'Настройки' }
        ];

        this.create = function () {
            SourceRegistry.resetAndScan();
            buildLayout();
            renderActiveTab();

            if (Config.isAutoSearch()) {
                HealthChecker.checkAll(false, function () {
                    if (!isDestroyed && (currentTab === 'sources' || currentTab === 'favorites')) {
                        renderActiveTab(true);
                    }
                });
            }

            return this.render();
        };

        function buildLayout() {
            html.empty();

            headerEl = $(
                '<div class="andrprod-hub__header">' +
                    '<div class="andrprod-hub__brand">' +
                        getLogoSvg('andrprod-hub__logo', 'hub') +
                        '<div class="andrprod-hub__subtitle">Единый центр онлайн-источников • v' + PLUGIN_VERSION + '</div>' +
                    '</div>' +
                    '<div class="andrprod-hub__actions">' +
                        '<div class="andrprod-pill selector andrprod-refresh-btn">Обновить источники</div>' +
                    '</div>' +
                '</div>'
            );

            tabsEl = $('<div class="andrprod-hub__tabs"></div>');
            var i;
            for (i = 0; i < TABS.length; i++) {
                (function (tab) {
                    var tabBtn = $(
                        '<div class="andrprod-tab selector" data-tab="' + tab.id + '">' +
                            tab.title +
                        '</div>'
                    );
                    if (tab.id === currentTab) tabBtn.addClass('is-active');
                    tabBtn.on('hover:enter', function () {
                        if (currentTab !== tab.id) {
                            currentTab = tab.id;
                            tabsEl.find('.andrprod-tab').removeClass('is-active');
                            tabBtn.addClass('is-active');
                            renderActiveTab();
                        }
                    });
                    tabsEl.append(tabBtn);
                })(TABS[i]);
            }

            headerEl.find('.andrprod-refresh-btn').on('hover:enter', function () {
                Lampa.Noty.show('ANDRPROD: Обновление списка и проверка доступности...');
                SourceRegistry.resetAndScan();
                HealthChecker.checkAll(true, function () {
                    if (!isDestroyed && (currentTab === 'sources' || currentTab === 'favorites')) {
                        renderActiveTab(true);
                    }
                }, function () {
                    if (!isDestroyed) {
                        Lampa.Noty.show('ANDRPROD: Проверка источников завершена.');
                        if (currentTab === 'sources' || currentTab === 'favorites') renderActiveTab(true);
                    }
                });
            });

            bodyEl = $('<div class="andrprod-hub__body"></div>');
            scroll.append(bodyEl);

            html.append(headerEl);
            html.append(tabsEl);
            html.append(scroll.render());
        }

        function renderActiveTab(preserveFocus) {
            if (isDestroyed) return;
            bodyEl.empty();

            if (currentTab === 'sources') {
                renderSourcesList(false);
            } else if (currentTab === 'favorites') {
                renderSourcesList(true);
            } else if (currentTab === 'movies') {
                renderMediaCatalog('movie');
            } else if (currentTab === 'series') {
                renderMediaCatalog('tv');
            } else if (currentTab === 'settings') {
                renderSettingsPanel();
            }

            if (!preserveFocus) {
                bindFocus();
            } else {
                Lampa.Controller.collectionSet(html);
            }
        }

        function renderSourcesList(onlyFavorites) {
            var sources = SourceRegistry.getSortedSources({
                onlyFavorites: onlyFavorites,
                respectHideBroken: !onlyFavorites
            });

            var summaryBar = $(
                '<div class="andrprod-info-bar">' +
                    '<span>Найдено источников: <b>' + sources.length + '</b></span>' +
                    '<span>Режим запуска: <b>' + (Config.getMode() === 'auto' ? 'Автоматический' : 'Ручной выбор') + '</b></span>' +
                '</div>'
            );
            bodyEl.append(summaryBar);

            if (!sources.length) {
                bodyEl.append(
                    '<div class="andrprod-empty">' +
                        '<div class="andrprod-empty__title">' +
                            (onlyFavorites ? 'Избранные источники пока не выбраны' : 'Совместимые онлайн-источники не обнаружены') +
                        '</div>' +
                        '<div class="andrprod-empty__desc">' +
                            (onlyFavorites
                                ? 'Откройте раздел «Все источники», выберите нужный плагин и добавьте его в избранное.'
                                : 'Установите онлайн-плагины в Lampa (например, Lumio, Alpaca, Lampac, Online Mod) или подключите API-адаптер, затем нажмите «Обновить источники».') +
                        '</div>' +
                    '</div>'
                );
                return;
            }

            var grid = $('<div class="andrprod-source-list"></div>');
            var i;
            for (i = 0; i < sources.length; i++) {
                (function (src, idx) {
                    var enabled = Config.isEnabled(src.id);
                    var fav = Config.isFavorite(src.id);
                    var health = SourceRegistry.getHealth(src.id);
                    var dotClass = getStatusDotClass(health.status);
                    var statusLabel = getStatusHumanLabel(health);

                    var card = $(
                        '<div class="andrprod-source-card selector ' + (enabled ? '' : 'is-disabled') + '">' +
                            '<div class="andrprod-source-card__left">' +
                                '<span class="andrprod-status-dot ' + dotClass + '"></span>' +
                                '<div class="andrprod-source-card__meta">' +
                                    '<div class="andrprod-source-card__title">' +
                                        '<span class="andrprod-rank">#' + (idx + 1) + '</span> ' +
                                        escapeHtml(src.name) +
                                        (fav ? ' <span class="andrprod-star">★</span>' : '') +
                                    '</div>' +
                                    '<div class="andrprod-source-card__sub">' +
                                        escapeHtml(src.detectedVia) + ' • ' + escapeHtml(statusLabel) +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                            '<div class="andrprod-source-card__right">' +
                                '<span class="andrprod-badge ' + (enabled ? 'is-on' : 'is-off') + '">' +
                                    (enabled ? 'Вкл' : 'Выкл') +
                                '</span>' +
                            '</div>' +
                        '</div>'
                    );

                    card.on('hover:enter', function () {
                        openSourceActionMenu(src);
                    });

                    card.on('hover:focus', function () {
                        lastFocused = card[0];
                        scroll.update(card, true);
                    });

                    grid.append(card);
                })(sources[i], i);
            }

            bodyEl.append(grid);
        }

        function openSourceActionMenu(src) {
            var enabled = Config.isEnabled(src.id);
            var fav = Config.isFavorite(src.id);
            var health = SourceRegistry.getHealth(src.id);

            var items = [
                {
                    title: enabled ? 'Отключить источник' : 'Включить источник',
                    action: 'toggle_enable'
                },
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
                    title: 'Проверить доступность сейчас',
                    subtitle: health.message || '',
                    action: 'ping'
                }
            ];

            Lampa.Select.show({
                title: src.name,
                items: items,
                onSelect: function (item) {
                    if (item.action === 'toggle_enable') {
                        Config.setEnabled(src.id, !enabled);
                        renderActiveTab();
                    } else if (item.action === 'toggle_fav') {
                        Config.toggleFavorite(src.id);
                        renderActiveTab();
                    } else if (item.action === 'move_up') {
                        Config.movePriority(src.id, -1);
                        renderActiveTab();
                    } else if (item.action === 'move_down') {
                        Config.movePriority(src.id, 1);
                        renderActiveTab();
                    } else if (item.action === 'ping') {
                        Lampa.Noty.show('Проверка ' + src.name + '...');
                        HealthChecker.checkSource(src, true, function (res) {
                            Lampa.Noty.show(src.name + ': ' + (res.message || res.status));
                            if (!isDestroyed) renderActiveTab();
                        });
                    }
                    Lampa.Controller.toggle('content');
                },
                onBack: function () {
                    Lampa.Controller.toggle('content');
                }
            });
        }

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
                    {
                        url: apiUrl,
                        page: 1,
                        source: apiSource
                    },
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
                        bodyEl.append(
                            '<div class="andrprod-empty">' +
                                '<div class="andrprod-empty__title">Не удалось загрузить каталог</div>' +
                                '<div class="andrprod-empty__desc">Проверьте основной источник метаданных (TMDB / CUB) в настройках Lampa.</div>' +
                            '</div>'
                        );
                        Lampa.Controller.collectionSet(html);
                    }
                );
            } catch (err) {
                bodyEl.empty();
                bodyEl.append(
                    '<div class="andrprod-empty">' +
                        '<div class="andrprod-empty__title">Каталог временно недоступен</div>' +
                        '<div class="andrprod-empty__desc">Откройте любой фильм или сериал через главный экран Lampa и нажмите кнопку ANDRPROD.</div>' +
                    '</div>'
                );
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

        function renderSettingsPanel() {
            var list = $('<div class="andrprod-settings-list"></div>');

            var rows = [
                {
                    title: 'Режим выбора источника',
                    desc: 'Ручной показывает список источников; Автоматический сразу запускает лучший рабочий.',
                    value: Config.getMode() === 'auto' ? 'Автоматический' : 'Ручной',
                    onEnter: function () {
                        Config.setMode(Config.getMode() === 'auto' ? 'manual' : 'auto');
                        renderActiveTab();
                    }
                },
                {
                    title: 'Автоматический поиск и проверка доступности',
                    desc: 'Проверять статус источников в фоне при открытии карточки и раздела ANDRPROD.',
                    value: Config.isAutoSearch() ? 'Включено' : 'Выключено',
                    onEnter: function () {
                        Config.setAutoSearch(!Config.isAutoSearch());
                        renderActiveTab();
                    }
                },
                {
                    title: 'Скрывать неработающие источники',
                    desc: 'Автоматически исключать из списка выдачи источники со статусом «Недоступен».',
                    value: Config.isHideBroken() ? 'Да' : 'Нет',
                    onEnter: function () {
                        Config.setHideBroken(!Config.isHideBroken());
                        renderActiveTab();
                    }
                },
                {
                    title: 'Тайм-аут сетевой проверки',
                    desc: 'Максимальное время ожидания ответа от сервера источника (защита от зависаний).',
                    value: Math.round(Config.getTimeout() / 1000) + ' сек',
                    onEnter: function () {
                        var options = [3000, 5000, 8000, 12000];
                        var cur = Config.getTimeout();
                        var idx = options.indexOf(cur);
                        var next = options[(idx + 1) % options.length];
                        Config.setTimeoutMs(next);
                        renderActiveTab();
                    }
                },
                {
                    title: 'Обновить список доступных интеграций',
                    desc: 'Повторно просканировать установленные плагины Lampa и проверить их статус.',
                    value: 'Запустить',
                    onEnter: function () {
                        SourceRegistry.resetAndScan();
                        HealthChecker.checkAll(true, null, function () {
                            Lampa.Noty.show('ANDRPROD: Список интеграций обновлён.');
                        });
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

        function bindFocus() {
            Lampa.Controller.collectionSet(html);
            var activeTabEl = tabsEl.find('.andrprod-tab.is-active')[0];
            if (activeTabEl) {
                Lampa.Controller.collectionFocus(activeTabEl, html);
            }
        }

        this.start = function () {
            Lampa.Controller.add('content', {
                toggle: function () {
                    Lampa.Controller.collectionSet(html);
                    Lampa.Controller.collectionFocus(lastFocused || tabsEl.find('.andrprod-tab.is-active')[0] || false, html);
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
                    Lampa.Activity.backward();
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

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // =========================================================================
    // 8. ИНТЕГРАЦИЯ В БОКОВОЕ МЕНЮ И НАСТРОЙКИ LAMPA
    // =========================================================================
    function addSidebarMenuItem() {
        try {
            var menuList = $('.menu .menu__list').eq(0);
            if (!menuList.length) return;
            if (menuList.find('.andrprod-menu-item').length) return;

            var item = $(
                '<li class="menu__item selector andrprod-menu-item">' +
                    '<div class="menu__ico">' + getMiniIconSvg() + '</div>' +
                    '<div class="menu__text andrprod-menu-text">' + getLogoSvg('andrprod-menu-logo', 'menu') + '</div>' +
                '</li>'
            );

            item.on('hover:enter', function () {
                HubLauncher.open('sources');
            });

            menuList.append(item);
        } catch (e) {
            // ignore menu insertion error on custom themes
        }
    }

    function registerLampaSettings() {
        if (!Lampa.SettingsApi) return;

        try {
            Lampa.SettingsApi.addComponent({
                component: PLUGIN_ID,
                name: 'ANDRPROD',
                icon: getMiniIconSvg()
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
                    name: 'Режим запуска',
                    description: 'Выбор между окном источников и автопереключением'
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
                    description: 'Проверять доступность плагинов при открытии карточки'
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
                    name: 'Скрывать неработающие источники',
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
                    description: 'Ограничение времени ожидания для защиты от зависания'
                }
            });

            Lampa.SettingsApi.addParam({
                component: PLUGIN_ID,
                param: {
                    name: 'andrprod_open_hub',
                    type: 'button'
                },
                field: {
                    name: 'Открыть центр управления ANDRPROD',
                    description: 'Приоритеты, избранное, включение/отключение источников'
                },
                onChange: function () {
                    HubLauncher.open('sources');
                }
            });
        } catch (e) {
            // graceful fallback for older Lampa builds
        }
    }

    // =========================================================================
    // 9. СТИЛИ ИНТЕРФЕЙСА (минималистичный премиальный ТВ-дизайн)
    // =========================================================================
    function injectStyles() {
        if ($('#andrprod-styles').length) return;

        var css = '' +
            /* Прозрачная кнопка ANDRPROD в карточке фильма — БЕЗ фона, рамки и подложки */
            '.andrprod-card-btn {' +
                'background: transparent !important;' +
                'border: none !important;' +
                'box-shadow: none !important;' +
                'padding: 0.45em 0.7em !important;' +
                'display: inline-flex !important;' +
                'align-items: center;' +
                'justify-content: center;' +
                'transition: transform 0.18s ease, filter 0.18s ease;' +
            '}' +
            '.andrprod-card-btn.focus, .andrprod-card-btn:hover {' +
                'background: transparent !important;' +
                'box-shadow: none !important;' +
                'transform: scale(1.08);' +
                'filter: drop-shadow(0 0 12px rgba(56, 189, 248, 0.75));' +
            '}' +
            '.andrprod-card-btn__logo {' +
                'height: 1.55em;' +
                'width: auto;' +
                'display: block;' +
            '}' +
            /* Логотип в боковом меню без подложки */
            '.andrprod-menu-logo {' +
                'height: 1.15em;' +
                'width: auto;' +
                'display: block;' +
                'background: transparent;' +
            '}' +
            '.andrprod-menu-text {' +
                'display: flex;' +
                'align-items: center;' +
            '}' +
            /* Главный экран ANDRPROD Hub */
            '.andrprod-hub {' +
                'padding: 1.4em 2em 2em 2em;' +
                'color: #E2E8F0;' +
            '}' +
            '.andrprod-hub__header {' +
                'display: flex;' +
                'align-items: center;' +
                'justify-content: space-between;' +
                'margin-bottom: 1.2em;' +
            '}' +
            '.andrprod-hub__logo {' +
                'height: 2.1em;' +
                'width: auto;' +
                'display: block;' +
            '}' +
            '.andrprod-hub__subtitle {' +
                'font-size: 0.85em;' +
                'color: rgba(226, 232, 240, 0.6);' +
                'margin-top: 0.25em;' +
            '}' +
            '.andrprod-pill {' +
                'padding: 0.55em 1.15em;' +
                'border-radius: 999px;' +
                'background: rgba(255, 255, 255, 0.08);' +
                'font-size: 0.9em;' +
                'transition: background 0.15s ease, transform 0.15s ease;' +
            '}' +
            '.andrprod-pill.focus {' +
                'background: #0EA5E9;' +
                'color: #FFFFFF;' +
                'transform: scale(1.03);' +
            '}' +
            /* Вкладки разделов */
            '.andrprod-hub__tabs {' +
                'display: flex;' +
                'flex-wrap: wrap;' +
                'gap: 0.65em;' +
                'margin-bottom: 1.3em;' +
            '}' +
            '.andrprod-tab {' +
                'padding: 0.6em 1.2em;' +
                'border-radius: 0.7em;' +
                'background: rgba(255, 255, 255, 0.06);' +
                'color: rgba(255, 255, 255, 0.78);' +
                'font-size: 0.95em;' +
                'font-weight: 500;' +
                'transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;' +
            '}' +
            '.andrprod-tab.is-active {' +
                'background: rgba(14, 165, 233, 0.22);' +
                'color: #7DD3FC;' +
            '}' +
            '.andrprod-tab.focus {' +
                'background: #0EA5E9;' +
                'color: #FFFFFF;' +
                'transform: scale(1.03);' +
            '}' +
            /* Инфо-строка */
            '.andrprod-info-bar {' +
                'display: flex;' +
                'justify-content: space-between;' +
                'margin-bottom: 1em;' +
                'font-size: 0.9em;' +
                'color: rgba(226, 232, 240, 0.72);' +
            '}' +
            /* Карточки источников */
            '.andrprod-source-list {' +
                'display: flex;' +
                'flex-direction: column;' +
                'gap: 0.65em;' +
            '}' +
            '.andrprod-source-card {' +
                'display: flex;' +
                'align-items: center;' +
                'justify-content: space-between;' +
                'padding: 0.95em 1.25em;' +
                'border-radius: 0.85em;' +
                'background: rgba(255, 255, 255, 0.05);' +
                'transition: background 0.15s ease, transform 0.15s ease;' +
            '}' +
            '.andrprod-source-card.is-disabled {' +
                'opacity: 0.5;' +
            '}' +
            '.andrprod-source-card.focus {' +
                'background: rgba(14, 165, 233, 0.24);' +
                'transform: scale(1.01);' +
                'box-shadow: 0 0 0 2px #38BDF8;' +
            '}' +
            '.andrprod-source-card__left {' +
                'display: flex;' +
                'align-items: center;' +
                'gap: 0.9em;' +
            '}' +
            '.andrprod-status-dot {' +
                'width: 0.7em;' +
                'height: 0.7em;' +
                'border-radius: 50%;' +
                'flex-shrink: 0;' +
            '}' +
            '.andrprod-status-dot.is-online { background: #22C55E; box-shadow: 0 0 8px rgba(34,197,94,0.7); }' +
            '.andrprod-status-dot.is-ready { background: #38BDF8; box-shadow: 0 0 8px rgba(56,189,248,0.6); }' +
            '.andrprod-status-dot.is-offline { background: #EF4444; }' +
            '.andrprod-status-dot.is-checking { background: #F59E0B; }' +
            '.andrprod-status-dot.is-unknown { background: #94A3B8; }' +
            '.andrprod-source-card__title {' +
                'font-size: 1.05em;' +
                'font-weight: 600;' +
                'color: #F8FAFC;' +
            '}' +
            '.andrprod-rank { color: #38BDF8; font-weight: 700; }' +
            '.andrprod-star { color: #FBBF24; }' +
            '.andrprod-source-card__sub {' +
                'font-size: 0.84em;' +
                'color: rgba(226, 232, 240, 0.65);' +
                'margin-top: 0.2em;' +
            '}' +
            '.andrprod-badge {' +
                'padding: 0.3em 0.8em;' +
                'border-radius: 999px;' +
                'font-size: 0.82em;' +
                'font-weight: 600;' +
            '}' +
            '.andrprod-badge.is-on { background: rgba(34, 197, 94, 0.18); color: #4ADE80; }' +
            '.andrprod-badge.is-off { background: rgba(148, 163, 184, 0.2); color: #CBD5E1; }' +
            /* Сетка фильмов и сериалов */
            '.andrprod-media-grid {' +
                'display: flex;' +
                'flex-wrap: wrap;' +
                'gap: 1em;' +
            '}' +
            '.andrprod-media-card {' +
                'width: 10.5em;' +
                'border-radius: 0.75em;' +
                'padding: 0.4em;' +
                'background: rgba(255, 255, 255, 0.04);' +
                'transition: transform 0.15s ease, box-shadow 0.15s ease;' +
            '}' +
            '.andrprod-media-card.focus {' +
                'transform: scale(1.05);' +
                'box-shadow: 0 0 0 2px #38BDF8;' +
                'background: rgba(14, 165, 233, 0.16);' +
            '}' +
            '.andrprod-media-card__poster {' +
                'width: 100%;' +
                'height: 14.5em;' +
                'border-radius: 0.55em;' +
                'background-color: rgba(255, 255, 255, 0.08);' +
                'background-size: cover;' +
                'background-position: center;' +
                'position: relative;' +
            '}' +
            '.andrprod-media-card__rate {' +
                'position: absolute;' +
                'top: 0.45em;' +
                'right: 0.45em;' +
                'padding: 0.15em 0.45em;' +
                'border-radius: 0.35em;' +
                'background: rgba(15, 23, 42, 0.85);' +
                'color: #38BDF8;' +
                'font-size: 0.78em;' +
                'font-weight: 700;' +
            '}' +
            '.andrprod-media-card__title {' +
                'margin-top: 0.5em;' +
                'font-size: 0.88em;' +
                'font-weight: 600;' +
                'white-space: nowrap;' +
                'overflow: hidden;' +
                'text-overflow: ellipsis;' +
            '}' +
            '.andrprod-media-card__year {' +
                'font-size: 0.76em;' +
                'color: rgba(226, 232, 240, 0.58);' +
                'margin-top: 0.15em;' +
            '}' +
            /* Панель настроек */
            '.andrprod-settings-list {' +
                'display: flex;' +
                'flex-direction: column;' +
                'gap: 0.65em;' +
            '}' +
            '.andrprod-setting-row {' +
                'display: flex;' +
                'align-items: center;' +
                'justify-content: space-between;' +
                'padding: 1em 1.25em;' +
                'border-radius: 0.85em;' +
                'background: rgba(255, 255, 255, 0.05);' +
            '}' +
            '.andrprod-setting-row.focus {' +
                'background: rgba(14, 165, 233, 0.24);' +
                'box-shadow: 0 0 0 2px #38BDF8;' +
            '}' +
            '.andrprod-setting-row__title { font-size: 1em; font-weight: 600; }' +
            '.andrprod-setting-row__desc { font-size: 0.82em; color: rgba(226,232,240,0.62); margin-top: 0.2em; }' +
            '.andrprod-setting-row__val {' +
                'font-size: 0.92em;' +
                'font-weight: 700;' +
                'color: #38BDF8;' +
                'margin-left: 1.5em;' +
                'white-space: nowrap;' +
            '}' +
            '.andrprod-empty, .andrprod-loading {' +
                'padding: 2.2em 1.5em;' +
                'text-align: center;' +
                'background: rgba(255, 255, 255, 0.04);' +
                'border-radius: 0.9em;' +
            '}' +
            '.andrprod-empty__title { font-size: 1.1em; font-weight: 600; margin-bottom: 0.45em; }' +
            '.andrprod-empty__desc { font-size: 0.9em; color: rgba(226, 232, 240, 0.68); max-width: 42em; margin: 0 auto; }';

        $('head').append('<style id="andrprod-styles">' + css + '</style>');
    }

    // =========================================================================
    // 10. ПУБЛИЧНЫЙ API ДЛЯ ВНЕШНИХ АДАПТЕРОВ (window.ANDRPROD_API)
    // =========================================================================
    window.ANDRPROD_API = {
        version: PLUGIN_VERSION,
        registerAdapter: function (adapter) {
            return SourceRegistry.registerAdapter(adapter);
        },
        getSources: function () {
            return SourceRegistry.getSortedSources();
        },
        rescan: function () {
            return SourceRegistry.resetAndScan();
        },
        openHub: function (tab) {
            HubLauncher.open(tab || 'sources');
        }
    };

    // =========================================================================
    // 11. ИНИЦИАЛИЗАЦИЯ ПЛАГИНА
    // =========================================================================
    function startPlugin() {
        try {
            injectStyles();
            Lampa.Component.add(HUB_COMPONENT, AndrprodHubComponent);
            SourceRegistry.resetAndScan();
            CardIntegration.init();
            registerLampaSettings();
            addSidebarMenuItem();
        } catch (err) {
            // Защита от падения Lampa при несовместимости окружения
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
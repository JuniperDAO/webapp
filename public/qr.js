/*!
 * Built with http://stenciljs.com
 * 2023-01-28T01:09:02
 */
!(function (e, t, o, r, n, i, s, c, u, l, a, d, p, m) {
    for (
        (a = e.QrCode = e.QrCode || {}).components = u,
            (p = u
                .filter(function (e) {
                    return e[2]
                })
                .map(function (e) {
                    return e[0]
                })).length &&
                (((d = t.createElement('style')).innerHTML = p.join() + '{visibility:hidden}.hydrated{visibility:inherit}'),
                d.setAttribute('data-styles', ''),
                t.head.insertBefore(d, t.head.firstChild)),
            (function (e, t, o) {
                ;(e['s-apps'] = e['s-apps'] || []).push('QrCode'),
                    o.componentOnReady ||
                        (o.componentOnReady = function () {
                            var t = this
                            function o(o) {
                                if (t.nodeName.indexOf('-') > 0) {
                                    for (var r = e['s-apps'], n = 0, i = 0; i < r.length; i++)
                                        if (e[r[i]].componentOnReady) {
                                            if (e[r[i]].componentOnReady(t, o)) return
                                            n++
                                        }
                                    if (n < r.length) return void (e['s-cr'] = e['s-cr'] || []).push([t, o])
                                }
                                o(null)
                            }
                            return e.Promise ? new e.Promise(o) : { then: o }
                        })
            })(e, 0, l),
            n = n || a.resourcesUrl,
            d = (p = t.querySelectorAll('script')).length - 1;
        d >= 0 && !(m = p[d]).src && !m.hasAttribute('data-resources-url');
        d--
    );
    ;(p = m.getAttribute('data-resources-url')),
        !n && p && (n = p),
        !n && m.src && (n = (p = m.src.split('/').slice(0, -1)).join('/') + (p.length ? '/' : '') + 'qr-code/'),
        (d = t.createElement('script')),
        (function (e, t, o, r) {
            return (
                !(t.search.indexOf('core=esm') > 0) &&
                (!(
                    !(t.search.indexOf('core=es5') > 0 || 'file:' === t.protocol) &&
                    e.customElements &&
                    e.customElements.define &&
                    e.fetch &&
                    e.CSS &&
                    e.CSS.supports &&
                    e.CSS.supports('color', 'var(--c)') &&
                    'noModule' in o
                ) ||
                    (function (e) {
                        try {
                            return new Function('import("")'), !1
                        } catch (e) {}
                        return !0
                    })())
            )
        })(e, e.location, d)
            ? (d.src = n + 'qr-code.y9wpr14h.js')
            : ((d.src = n + 'qr-code.orxjfzvr.js'), d.setAttribute('type', 'module'), d.setAttribute('crossorigin', !0)),
        d.setAttribute('data-resources-url', n),
        d.setAttribute('data-namespace', 'qr-code'),
        t.head.appendChild(d)
})(
    window,
    document,
    0,
    0,
    0,
    0,
    0,
    0,
    [
        [
            'qr-code',
            'mu42bxql',
            1,
            [
                ['animateQRCode', 6],
                ['contents', 1, 0, 1, 2],
                ['data', 5],
                ['getModuleCount', 6],
                ['maskXToYRatio', 1, 0, 'mask-x-to-y-ratio', 4],
                ['moduleColor', 1, 0, 'module-color', 2],
                ['moduleCount', 5],
                ['positionCenterColor', 1, 0, 'position-center-color', 2],
                ['positionRingColor', 1, 0, 'position-ring-color', 2],
                ['protocol', 1, 0, 1, 2],
                ['qrCodeElement', 7],
                ['squares', 1, 0, 1, 3],
            ],
            1,
        ],
    ],
    HTMLElement.prototype
)
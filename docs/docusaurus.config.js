// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/dracula');

/** @type {import('@docusaurus/types').Config} */
const config = {
    title: 'Simple JS Tools',
    tagline: '简单的Javascript工具包',
    favicon: 'img/favicon.ico',

    // Set the production url of your site here
    url: 'https://yalejian.github.io',
    // Set the /<baseUrl>/ pathname under which your site is served
    // For GitHub pages deployment, it is often '/<projectName>/'
    baseUrl: '/simple-js-tools',

    // GitHub pages deployment config.
    // If you aren't using GitHub pages, you don't need these.
    organizationName: 'yalejian', // Usually your GitHub org/user name.
    projectName: 'simple-js-tools', // Usually your repo name.
    deploymentBranch: 'gh-pages',
    trailingSlash: false,

    onBrokenLinks: 'throw',
    onBrokenMarkdownLinks: 'warn',

    // Even if you don't use internalization, you can use this field to set useful
    // metadata like html lang. For example, if your site is Chinese, you may want
    // to replace "en" with "zh-Hans".
    i18n: {
        defaultLocale: 'zh',
        locales: ['zh'],
    },
    plugins: [require.resolve('docusaurus-lunr-search')],

    presets: [
        //预设
        [
            'classic',
            /** @type {import('@docusaurus/preset-classic').Options} */
            ({
                docs: {
                    path:"document",
                    sidebarPath: require.resolve('./sidebars.js'),
                    // Please change this to your repo.
                    // Remove this to remove the "edit this page" links.
                    editUrl:
                        'https://github.com/YaleJian/simple-js-tools',
                },
                blog: {
                    showReadingTime: true,
                    // Please change this to your repo.
                    // Remove this to remove the "edit this page" links.
                    editUrl:
                        'https://github.com/YaleJian/simple-js-tools',
                    blogSidebarTitle: '最新文章',
                    blogSidebarCount: 0,
                },
                theme: {
                    customCss: require.resolve('./src/css/custom.css'),
                },
            }),
        ],
    ],

    themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
        ({
            // Replace with your project's social card
            image: 'img/docusaurus-social-card.jpg',//元标签的默认图像
            colorMode: {
                defaultMode: 'light',
                disableSwitch: false,
                respectPrefersColorScheme: true,
            },
            /*announcementBar: {
                id: 'support_us',
                content:
                    '编码不易，给个星星支持下吧 <a target="_blank" rel="noopener noreferrer" href="https://github.com/YaleJian/simple-js-tools">GitHub</a>',
                backgroundColor: '#fafbfc',
                textColor: '#091E42',
                isCloseable: false,
            },*/
            tableOfContents: {
                minHeadingLevel: 2,
                maxHeadingLevel: 6,
            },
            navbar: {
                title: 'Simple JS Tools',
                logo: {
                    alt: 'Simple JS Tools',
                    src: 'img/favicon.ico',
                    srcDark: 'img/favicon.ico',
                    href: '/',
                    target: '_self',
                    width: 32,
                    height: 32,
                    className: 'custom-navbar-logo-class',
                    style: {border: 'white'},
                },
                hideOnScroll: true,//滚动自动隐藏导航栏
                items: [
                    {
                        type: 'docSidebar',
                        sidebarId: 'apiSidebar',
                        position: 'left',
                        label: 'API参考',
                    },
                    {to: '/blog', label: '相关文章', position: 'left'},
                    {
                        type: 'search',
                        position: 'left',
                    },
                    /*
                    {
                        type: 'docsVersionDropdown',
                        position: 'right',
                        dropdownItemsAfter: [{to: '/docs/API/intro', label: '1.0.0-beta.2'}],
                        dropdownActiveClassDisabled: false,
                    },*/
                    {
                        type: 'localeDropdown',
                        position: 'right',
                    },
                    {
                        href: 'https://github.com/YaleJian/simple-js-tools',
                        label: 'GitHub',
                        position: 'right',
                    },
                ],
            },
            footer: {
                style: 'light',
                links: [
                    {
                        title: '快捷链接',
                        items: [
                            {
                                label: 'API参考',
                                to: '/docs/API/intro',
                            },
                        ],
                    },
                    {
                        title: '沟通',
                        items: [
                            {
                                label: '讨论',
                                href: 'https://github.com/YaleJian/simple-js-tools/discussions',
                            },
                            {
                                label: '反馈',
                                href: 'https://github.com/YaleJian/simple-js-tools/issues',
                            },
                        ],
                    },
                    {
                        title: '阅读',
                        items: [
                            {
                                label: '相关文章',
                                to: '/blog',
                            },
                        ],
                    },
                    {
                        title: '友情链接',
                        items: [
                            {
                                label: 'Docusaurus',
                                href: 'https://docusaurus.io/zh-CN/'
                            }
                        ],
                    },
                ],
                copyright: `Copyright © ${new Date().getFullYear()} Yale Jian`,
            },
            prism: {
                //Docusaurus使用Prism React Renderer来突出显示代码块
                theme: lightCodeTheme,
                darkTheme: darkCodeTheme,
            },
        }),
};

module.exports = config;

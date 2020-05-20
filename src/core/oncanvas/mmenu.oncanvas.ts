import * as pack from '../../../package.json';
import options from './_options';
import configs from './_configs';
import translate from './translations/translate';
import * as DOM from '../../_modules/dom';
import * as i18n from '../../_modules/i18n';
import * as media from '../../_modules/matchmedia';
import {
    type,
    extend,
    transitionend,
    uniqueId,
    valueOrFn,
} from '../../_modules/helpers';

//  Add the translations.
translate();

/**
 * Class for a mobile menu.
 */
export default class Mmenu {
    /**	Plugin version. */
    static version: string = pack.version;

    /**	Default options for menus. */
    static options: mmOptions = options;

    /**	Default configuration for menus. */
    static configs: mmConfigs = configs;

    /**	Available add-ons for the plugin. */
    static addons: mmLooseObject = {};

    /** Available wrappers for the plugin. */
    static wrappers: mmFunctionObject = {};

    /**	Globally used HTML elements. */
    static node: mmHtmlObject = {};

    /** Globally used variables. */
    static vars: mmLooseObject = {};

    /** MutationObserver for adding a listview to a panel. */
    panelObserver: MutationObserver;

    /** MutationObserver for adding a listitem to a listview. */
    listviewObserver: MutationObserver;

    /** MutationObserver for adding a listview to a listitem. */
    listitemObserver: MutationObserver;

    /**	Options for the menu. */
    opts: mmOptions;

    /** Configuration for the menu. */
    conf: mmConfigs;

    /**	Array of method names to expose in the API. */
    _api: string[];

    /** The API. */
    API: mmApi;

    /** HTML elements used for the menu. */
    node: mmHtmlObject;

    /** Variables used for the menu. */
    vars: mmLooseObject;

    /** Callback hooks used for the menu. */
    hook: mmLooseObject;

    /** Click handlers used for the menu. */
    clck: Function[];

    /** Log deprecated warnings when using the debugger. */
    _deprecatedWarnings: Function;

    //	offCanvas add-on

    /** Open the menu. */
    open: Function;

    /** Setup the menu so it can be opened. */
    _openSetup: Function;

    /** The menu starts opening. */
    _openStart: Function;

    /** Close the menu. */
    close: Function;

    /** Close all other menus. */
    closeAllOthers: Function;

    /** Set the page HTML element. */
    setPage: Function;

    //	searchfield add-on

    /** Search the menu */
    search: Function;

    /**
     * Create a mobile menu.
     * @param {HTMLElement|string} 	menu						The menu node.
     * @param {object} 				[options=Mmenu.options]		Options for the menu.
     * @param {object} 				[configs=Mmenu.configs]		Configuration options for the menu.
     */
    constructor(
        menu: HTMLElement | string,
        options?: mmOptions,
        configs?: mmConfigs
    ) {
        //	Extend options and configuration from defaults.
        this.opts = extend(options, Mmenu.options);
        this.conf = extend(configs, Mmenu.configs);

        //	Methods to expose in the API.
        this._api = [
            'bind',
            'openPanel',
            'closePanel',
            'closeAllPanels',
            'setSelected',
        ];

        //	Storage objects for nodes, variables, hooks and click handlers.
        this.node = {};
        this.vars = {};
        this.hook = {};
        this.clck = [];

        //	Get menu node from string or element.
        this.node.menu =
            typeof menu == 'string' ? document.querySelector(menu) : menu;

        if (typeof this._deprecatedWarnings == 'function') {
            this._deprecatedWarnings();
        }

        this._initObservers();

        this._initWrappers();
        this._initAddons();
        this._initExtensions();

        this._initHooks();
        this._initAPI();

        this._initMenu();
        this._initPanels();
        this._initOpened(); // TODO: volgorde klopt niet meer
        this._initAnchors();

        media.watch();

        return this;
    }

    /**
     * Open a panel.
     * @param {HTMLElement} panel				Panel to open.
     * @param {boolean}		[animation=true]	Whether or not to open the panel with an animation.
     */
    openPanel(panel: HTMLElement, animation?: boolean) {
        //	Invoke "before" hook.
        this.trigger('openPanel:before', [panel]);

        //	Find panel.
        if (!panel) {
            return;
        }

        if (!panel.matches('.mm-panel')) {
            panel = panel.closest('.mm-panel') as HTMLElement;
        }

        if (!panel) {
            return;
        }
        //	/Find panel.

        if (typeof animation != 'boolean') {
            animation = true;
        }

        //	Open a "vertical" panel.
        if (panel.parentElement.matches('.mm-listitem_vertical')) {
            //	Open current and all vertical parent panels.
            DOM.parents(panel, '.mm-listitem_vertical').forEach((listitem) => {
                listitem.classList.add('mm-listitem_opened');
                DOM.children(listitem, '.mm-panel').forEach((panel) => {
                    panel.classList.remove('mm-hidden');
                });
            });

            //	Open first non-vertical parent panel.
            let parents = DOM.parents(panel, '.mm-panel').filter(
                (panel) => !panel.parentElement.matches('.mm-listitem_vertical')
            );

            this.trigger('openPanel:start', [panel]);

            if (parents.length) {
                this.openPanel(parents[0]);
            }

            this.trigger('openPanel:finish', [panel]);

            //	Open a "horizontal" panel.
        } else {
            if (panel.matches('.mm-panel_opened')) {
                return;
            }

            let panels = DOM.children(this.node.pnls, '.mm-panel'),
                current = DOM.children(this.node.pnls, '.mm-panel_opened')[0];

            //	Close all child panels.
            panels
                .filter((parent) => parent !== panel)
                .forEach((parent) => {
                    parent.classList.remove('mm-panel_opened-parent');
                });

            //	Open all parent panels.
            let parent: HTMLElement = null;
            if (panel.dataset.mmParent) {
                parent = DOM.find(
                    this.node.pnls,
                    '#' + panel.dataset.mmParent
                )[0];
            }

            while (parent) {
                parent = parent.closest('.mm-panel') as HTMLElement;
                if (parent) {
                    if (
                        !parent.parentElement.matches('.mm-listitem_vertical')
                    ) {
                        parent.classList.add('mm-panel_opened-parent');
                    }

                    if (parent.dataset.mmParent) {
                        parent = DOM.find(
                            this.node.pnls,
                            '#' + parent.dataset.mmParent
                        )[0];
                    } else {
                        parent = null;
                    }
                }
            }

            //	Add classes for animation.
            panels.forEach((panel) => {
                panel.classList.remove('mm-panel_highest');
            });

            panels
                .filter((hidden) => hidden !== current)
                .filter((hidden) => hidden !== panel)
                .forEach((hidden) => {
                    hidden.classList.add('mm-hidden');
                });

            panel.classList.remove('mm-hidden');

            /**	Start opening the panel. */
            let openPanelStart = () => {
                if (current) {
                    current.classList.remove('mm-panel_opened');
                }
                panel.classList.add('mm-panel_opened');

                if (panel.matches('.mm-panel_opened-parent')) {
                    if (current) {
                        current.classList.add('mm-panel_highest');
                    }
                    panel.classList.remove('mm-panel_opened-parent');
                } else {
                    if (current) {
                        current.classList.add('mm-panel_opened-parent');
                    }
                    panel.classList.add('mm-panel_highest');
                }

                //	Invoke "start" hook.
                this.trigger('openPanel:start', [panel]);
            };

            /**	Finish opening the panel. */
            let openPanelFinish = () => {
                if (current) {
                    current.classList.remove('mm-panel_highest');
                    current.classList.add('mm-hidden');
                }
                panel.classList.remove('mm-panel_highest');

                //	Invoke "finish" hook.
                this.trigger('openPanel:finish', [panel]);
            };

            if (animation && !panel.matches('.mm-panel_noanimation')) {
                //	Without the timeout the animation will not work because the element had display: none;
                setTimeout(() => {
                    //	Callback
                    transitionend(
                        panel,
                        () => {
                            openPanelFinish();
                        },
                        this.conf.transitionDuration
                    );

                    openPanelStart();
                }, this.conf.openingInterval);
            } else {
                openPanelStart();
                openPanelFinish();
            }
        }

        //	Invoke "after" hook.
        this.trigger('openPanel:after', [panel]);
    }

    /**
     * Close a panel.
     * @param {HTMLElement} panel Panel to close.
     */
    closePanel(panel: HTMLElement) {
        //	Invoke "before" hook.
        this.trigger('closePanel:before', [panel]);

        var li = panel.parentElement;

        //	Only works for "vertical" panels.
        if (li.matches('.mm-listitem_vertical')) {
            li.classList.remove('mm-listitem_opened');
            panel.classList.add('mm-hidden');

            //	Invoke main hook.
            this.trigger('closePanel', [panel]);
        }

        //	Invoke "after" hook.
        this.trigger('closePanel:after', [panel]);
    }

    /**
     * Close all opened panels.
     * @param {HTMLElement} panel Panel to open after closing all other panels.
     */
    closeAllPanels(panel?: HTMLElement) {
        //	Invoke "before" hook.
        this.trigger('closeAllPanels:before');

        //	Close all "vertical" panels.
        DOM.find(this.node.pnls, '.mm-listitem').forEach((listitem) => {
            listitem.classList.remove('mm-listitem_selected');
            listitem.classList.remove('mm-listitem_opened');
        });

        //	Close all "horizontal" panels.
        const panels = DOM.children(this.node.pnls, '.mm-panel'),
            opened = panel ? panel : panels[0];

        DOM.children(this.node.pnls, '.mm-panel').forEach((panel) => {
            if (panel !== opened) {
                panel.classList.remove('mm-panel_opened');
                panel.classList.remove('mm-panel_opened-parent');
                panel.classList.remove('mm-panel_highest');
                panel.classList.add('mm-hidden');
            }
        });

        //	Open first panel.
        this.openPanel(opened, false);

        //	Invoke "after" hook.
        this.trigger('closeAllPanels:after');
    }

    /**
     * Toggle a panel opened/closed.
     * @param {HTMLElement} panel Panel to open or close.
     */
    togglePanel(panel: HTMLElement) {
        let listitem = panel.parentElement;

        //	Only works for "vertical" panels.
        if (listitem.matches('.mm-listitem_vertical')) {
            this[
                listitem.matches('.mm-listitem_opened')
                    ? 'closePanel'
                    : 'openPanel'
            ](panel);
        }
    }

    /**
     * Display a listitem as being "selected".
     * @param {HTMLElement} listitem Listitem to mark.
     */
    setSelected(listitem: HTMLElement) {
        //	Invoke "before" hook.
        this.trigger('setSelected:before', [listitem]);

        //	First, remove the selected class from all listitems.
        DOM.find(this.node.menu, '.mm-listitem_selected').forEach((li) => {
            li.classList.remove('mm-listitem_selected');
        });

        //	Next, add the selected class to the provided listitem.
        listitem.classList.add('mm-listitem_selected');

        //	Invoke "after" hook.
        this.trigger('setSelected:after', [listitem]);
    }

    /**
     * Bind functions to a hook (subscriber).
     * @param {string} 		hook The hook.
     * @param {function} 	func The function.
     */
    bind(hook: string, func: Function) {
        //	Create an array for the hook if it does not yet excist.
        this.hook[hook] = this.hook[hook] || [];

        //	Push the function to the array.
        this.hook[hook].push(func);
    }

    /**
     * Invoke the functions bound to a hook (publisher).
     * @param {string} 	hook  	The hook.
     * @param {array}	[args] 	Arguments for the function.
     */
    trigger(hook: string, args?: any[]) {
        if (this.hook[hook]) {
            for (var h = 0, l = this.hook[hook].length; h < l; h++) {
                this.hook[hook][h].apply(this, args);
            }
        }
    }

    _initObservers() {
        this.panelObserver = new MutationObserver((mutationsList) => {
            mutationsList.forEach((mutation) => {
                mutation.addedNodes.forEach((listview: HTMLElement) => {
                    if (listview.matches(this.conf.panelNodetype.join(', '))) {
                        this._initListview(listview);
                    }
                });
            });
        });

        this.listviewObserver = new MutationObserver((mutationsList) => {
            mutationsList.forEach((mutation) => {
                mutation.addedNodes.forEach((listitem: HTMLElement) => {
                    this._initListitem(listitem);
                });
            });
        });

        this.listitemObserver = new MutationObserver((mutationsList) => {
            mutationsList.forEach((mutation) => {
                mutation.addedNodes.forEach((listview: HTMLElement) => {
                    if (listview.matches(this.conf.panelNodetype.join(', '))) {
                        this._initSubPanel(listview);
                    }
                });
            });
        });
    }

    /**
     * Create the API.
     */
    _initAPI() {
        //	We need this=that because:
        //	1) the "arguments" object can not be referenced in an arrow function in ES3 and ES5.
        var that = this;

        (this.API as mmLooseObject) = {};

        this._api.forEach((fn) => {
            this.API[fn] = function () {
                var re = that[fn].apply(that, arguments); // 1)
                return typeof re == 'undefined' ? that.API : re;
            };
        });

        //	Store the API in the HTML node for external usage.
        this.node.menu['mmApi'] = this.API;
    }

    /**
     * Bind the hooks specified in the options (publisher).
     */
    _initHooks() {
        for (let hook in this.opts.hooks) {
            this.bind(hook, this.opts.hooks[hook]);
        }
    }

    /**
     * Initialize the wrappers specified in the options.
     */
    _initWrappers() {
        //	Invoke "before" hook.
        this.trigger('initWrappers:before');

        for (let w = 0; w < this.opts.wrappers.length; w++) {
            let wrpr = Mmenu.wrappers[this.opts.wrappers[w]];
            if (typeof wrpr == 'function') {
                wrpr.call(this);
            }
        }

        //	Invoke "after" hook.
        this.trigger('initWrappers:after');
    }

    /**
     * Initialize all available add-ons.
     */
    _initAddons() {
        //	Invoke "before" hook.
        this.trigger('initAddons:before');

        for (let addon in Mmenu.addons) {
            Mmenu.addons[addon].call(this);
        }

        //	Invoke "after" hook.
        this.trigger('initAddons:after');
    }

    /**
     * Initialize the extensions specified in the options.
     */
    _initExtensions() {
        //	Invoke "before" hook.
        this.trigger('initExtensions:before');

        //	Convert array to object with array.
        if (type(this.opts.extensions) == 'array') {
            this.opts.extensions = {
                all: this.opts.extensions,
            };
        }

        //	Loop over object.
        Object.keys(this.opts.extensions).forEach((query) => {
            let classnames = this.opts.extensions[query].map(
                (extension) => 'mm-menu_' + extension
            );

            if (classnames.length) {
                media.add(
                    query,
                    () => {
                        this.node.menu.classList.add(...classnames);
                    },
                    () => {
                        this.node.menu.classList.remove(...classnames);
                    }
                );
            }
        });

        //	Invoke "after" hook.
        this.trigger('initExtensions:after');
    }

    /**
     * Initialize the menu.
     */
    _initMenu() {
        //	Invoke "before" hook.
        this.trigger('initMenu:before');

        //	Add class to the wrapper.
        this.node.wrpr = this.node.wrpr || this.node.menu.parentElement;
        this.node.wrpr.classList.add('mm-wrapper');

        //	Add class to the menu.
        this.node.menu.classList.add('mm-menu');

        //	Add an ID to the menu if it does not yet have one.
        this.node.menu.id = this.node.menu.id || uniqueId();

        const panels = DOM.children(this.node.menu).filter((panel) =>
            panel.matches(this.conf.panelNodetype.join(', '))
        );

        //	Wrap the panels in a node.
        this.node.pnls = DOM.create('div.mm-panels');

        this.node.menu.append(this.node.pnls);

        /////// TEST
        //   initPanel aanroepen op iedere node die in this.node.pnls komt
        (() => {
            // const observer = new MutationObserver((mutationsList, observer) => {
            //     for (let m = 0; m < mutationsList.length; m++) {
            //         if (mutationsList[m].addedNodes.length) {
            //             // console.log(
            //             //     'A child node has been added.',
            //             //     mutationsList[m].addedNodes[0],
            //             //     m
            //             // );
            //             this._initPanel(
            //                 mutationsList[m].addedNodes[0] as HTMLElement
            //             );
            //         }
            //     }
            // });
            // observer.observe(this.node.pnls, {
            //     attributes: false,
            //     childList: true,
            //     subtree: false
            // });
        })();
        ///////

        //  Initiate all panel like nodes
        panels.forEach((panel) => {
            this._initPanel(panel);
        });

        //	Invoke "after" hook.
        this.trigger('initMenu:after');
    }

    /**
     * Initialize panels.
     */
    _initPanels() {
        //	Invoke "before" hook.
        this.trigger('initPanels:before');

        //	Open / close panels.
        this.clck.push((anchor: HTMLAnchorElement, args: mmClickArguments) => {
            if (args.inMenu) {
                var href = anchor.getAttribute('href');
                if (href && href.length > 1 && href.slice(0, 1) == '#') {
                    try {
                        const panel = DOM.find(this.node.menu, href)[0];

                        if (panel && panel.matches('.mm-panel')) {
                            if (
                                anchor.parentElement.matches(
                                    '.mm-listitem_vertical'
                                )
                            ) {
                                this.togglePanel(panel);
                            } else {
                                this.openPanel(panel);
                            }
                            return true;
                        }
                    } catch (err) {}
                }
            }
        });

        //	Invoke "after" hook.
        this.trigger('initPanels:after');
    }

    /**
     * Initialize a single panel.
     * @param  {HTMLElement} 		panel 	Panel to initialize.
     * @return {HTMLElement|null} 			Initialized panel.
     */
    _initPanel(panel: HTMLElement): HTMLElement {
        //	Invoke "before" hook.
        this.trigger('initPanel:before', [panel]);

        if (panel.matches('.mm-panel')) {
            return null;
        }

        //	Refactor panel classnames
        DOM.reClass(panel, this.conf.classNames.panel, 'mm-panel');
        DOM.reClass(panel, this.conf.classNames.nopanel, 'mm-nopanel');
        DOM.reClass(panel, this.conf.classNames.inset, 'mm-listview_inset');

        if (panel.matches('.mm-listview_inset')) {
            panel.classList.add('mm-nopanel');
        }

        //	Stop if not supposed to be a panel.
        if (panel.matches('.mm-nopanel')) {
            return null;
        }

        //  Must have an ID
        panel.id = panel.id || uniqueId();

        //	Wrap UL/OL in DIV
        if (panel.matches('ul, ol')) {
            /** The panel. */
            let wrapper = DOM.create('div');

            //  Transport the ID
            wrapper.id = panel.id;
            panel.removeAttribute('id');

            //  Transport the "mm-" prefixed classnames
            Array.prototype.slice
                .call(panel.classList)
                .filter((classname) => classname.slice(0, 3) == 'mm-')
                .forEach((classname) => {
                    panel.classList.remove(classname);
                    wrapper.classList.add(classname);
                });

            //  Transport the parent relation
            if (panel.dataset.mmParent) {
                wrapper.dataset.mmParent = panel.dataset.mmParent;
                delete panel.dataset.mmParent;
            }

            //	Wrap the listview in the panel.
            panel.before(wrapper);
            wrapper.append(panel);
            panel = wrapper;
        }

        panel.classList.add('mm-panel', 'mm-hidden');

        //  Append to the panels node if not vertically expanding
        if (!panel.parentElement.matches('.mm-listitem_vertical')) {
            this.node.pnls.append(panel);
        }

        //  Initialize tha navbar.
        this._initNavbar(panel);

        //  Initialize the listview(s).
        DOM.children(panel, 'ul, ol').forEach((listview) => {
            this._initListview(listview);
        });

        // Observe the panel for added listviews.
        this.panelObserver.observe(panel, {
            childList: true,
        });

        //	Invoke "after" hook.
        this.trigger('initPanel:after', [panel]);

        return panel;
    }

    /**
     * Initialize a navbar.
     * @param {HTMLElement} panel Panel for the navbar.
     */
    _initNavbar(panel: HTMLElement) {
        //	Invoke "before" hook.
        this.trigger('initNavbar:before', [panel]);

        //	Only one navbar per panel.
        if (DOM.children(panel, '.mm-navbar').length) {
            return;
        }

        /** The parent listitem. */
        let parentListitem: HTMLElement = null;

        /** The parent panel. */
        let parentPanel: HTMLElement = null;

        //  The parent listitem and parent panel
        if (panel.dataset.mmParent) {
            parentListitem = DOM.find(
                this.node.pnls,
                '#' + panel.dataset.mmParent
            )[0];

            parentPanel = parentListitem.closest('.mm-panel') as HTMLElement;
        }

        //  No navbar needed for vertical submenus.
        if (parentListitem && parentListitem.matches('.mm-listitem_vertical')) {
            return;
        }

        /** The navbar element. */
        let navbar = DOM.create('div.mm-navbar');

        //  Hide navbar if specified in options.
        if (!this.opts.navbar.add) {
            navbar.classList.add('mm-hidden');
        }

        //  Sticky navbars.
        else if (this.opts.navbar.sticky) {
            navbar.classList.add('mm-navbar_sticky');
        }

        //  Add the back button.
        if (parentPanel) {
            /** The back button. */
            let prev = DOM.create(
                'a.mm-btn.mm-btn_prev.mm-navbar__btn'
            ) as HTMLAnchorElement;
            prev.href = '#' + parentPanel.id;

            navbar.append(prev);
        }

        /** The anchor that opens the panel. */
        let opener: HTMLElement = null;

        //  The anchor is in a listitem.
        if (parentListitem) {
            opener = DOM.children(parentListitem, '.mm-listitem__text')[0];
        }

        //  The anchor is in a panel.
        else if (parentPanel) {
            opener = DOM.find(parentPanel, 'a[href="#' + panel.id + '"]')[0];
        }

        //  Add the title.
        let title = DOM.create('a.mm-navbar__title');
        let titleText = DOM.create('span');
        title.append(titleText);
        titleText.innerHTML =
            panel.dataset.mmTitle ||
            (opener ? opener.textContent : '') ||
            this.i18n(this.opts.navbar.title) ||
            this.i18n('Menu');

        switch (this.opts.navbar.titleLink) {
            case 'anchor':
                if (opener) {
                    title.setAttribute('href', opener.getAttribute('href'));
                }
                break;

            case 'parent':
                if (parentPanel) {
                    title.setAttribute('href', '#' + parentPanel.id);
                }
                break;
        }

        navbar.append(title);

        panel.prepend(navbar);

        //	Invoke "after" hook.
        this.trigger('initNavbar:after', [panel]);
    }

    /**
     * Initialize a listview.
     * @param {HTMLElement} listview Listview to initialize.
     */
    _initListview(listview: HTMLElement) {
        //	Invoke "before" hook.
        this.trigger('initListview:before', [listview]);

        DOM.reClass(listview, this.conf.classNames.nolistview, 'mm-nolistview');

        if (!listview.matches('.mm-nolistview')) {
            listview.classList.add('mm-listview');

            //  Initiate the listitem(s).
            DOM.children(listview).forEach((listitem) => {
                this._initListitem(listitem);
            });

            // Observe the listview for added listitems.
            this.listviewObserver.observe(listview, {
                childList: true,
            });
        }

        //	Invoke "after" hook.
        this.trigger('initListview:after', [listview]);
    }

    /**
     * Initialte a listitem.
     * @param {HTMLElement} listitem Listitem to initiate.
     */
    _initListitem(listitem: HTMLElement) {
        listitem.classList.add('mm-listitem');

        DOM.reClass(
            listitem,
            this.conf.classNames.selected,
            'mm-listitem_selected'
        );

        DOM.children(listitem, 'a, span').forEach((text) => {
            text.classList.add('mm-listitem__text');
        });

        //  Initiate the subpanel.
        DOM.children(listitem, this.conf.panelNodetype.join(', ')).forEach(
            (subpanel) => {
                this._initSubPanel(subpanel);
            }
        );

        // Observe the listview for added listitems.
        this.listitemObserver.observe(listitem, {
            childList: true,
        });
    }

    /**
     * Initiate a subpanel.
     * @param {HTMLElement} subpanel Subpanel to initiate.
     */
    _initSubPanel(subpanel: HTMLElement) {
        /** The parent element for the panel. */
        const listitem: HTMLElement = subpanel.parentElement;

        /** Whether or not the listitem expands vertically */
        const vertical: boolean =
            subpanel.matches('.' + this.conf.classNames.vertical) ||
            !this.opts.slidingSubmenus;

        // Make it expand vertically
        if (vertical) {
            listitem.classList.add('mm-listitem_vertical');
        }

        //  Force an ID
        listitem.id = listitem.id || uniqueId();
        subpanel.id = subpanel.id || uniqueId();

        //  Store parent/child relation
        listitem.dataset.mmChild = subpanel.id;
        subpanel.dataset.mmParent = listitem.id;

        /** The open link. */
        let button = DOM.children(listitem, '.mm-btn')[0] as HTMLAnchorElement;

        //  Init item text
        if (!button) {
            button = DOM.create(
                'a.mm-btn.mm-btn_next.mm-listitem__btn'
            ) as HTMLAnchorElement;

            DOM.children(listitem, 'a, span').forEach((text) => {
                //  If the item has no link,
                //      Replace the item with the open link.
                if (text.matches('span')) {
                    button.classList.add('mm-listitem__text');
                    button.innerHTML = text.innerHTML;
                    listitem.insertBefore(button, text.nextElementSibling);
                    text.remove();
                }

                //  Otherwise, insert the button after the text.
                else {
                    listitem.insertBefore(button, text.nextElementSibling);
                }
            });
        }

        button.href = '#' + subpanel.id;

        this._initPanel(subpanel);
    }

    /**
     * Find and open the correct panel after creating the menu.
     */
    _initOpened() {
        //	Invoke "before" hook.
        this.trigger('initOpened:before');

        /** The selected listitem(s). */
        let listitems = this.node.pnls.querySelectorAll(
            '.mm-listitem_selected'
        );

        /** The last selected listitem. */
        let lastitem = null;

        //	Deselect the listitems.
        listitems.forEach((listitem) => {
            lastitem = listitem;
            listitem.classList.remove('mm-listitem_selected');
        });

        //	Re-select the last listitem.
        if (lastitem) {
            lastitem.classList.add('mm-listitem_selected');
        }

        /**	The current opened panel. */
        let current = lastitem
            ? lastitem.closest('.mm-panel')
            : DOM.children(this.node.pnls, '.mm-panel')[0];

        //	Open the current opened panel.
        this.openPanel(current, false);

        //	Invoke "after" hook.
        this.trigger('initOpened:after');
    }

    /**
     * Initialize anchors in / for the menu.
     */
    _initAnchors() {
        //	Invoke "before" hook.
        this.trigger('initAnchors:before');

        document.addEventListener(
            'click',
            (evnt) => {
                /** The clicked element. */
                var target = (evnt.target as HTMLElement).closest(
                    'a[href]'
                ) as HTMLElement;
                if (!target) {
                    return;
                }

                /** Arguments passed to the bound methods. */
                var args: mmClickArguments = {
                    inMenu: target.closest('.mm-menu') === this.node.menu,
                    inListview: target.matches('.mm-listitem > a'),
                    toExternal:
                        target.matches('[rel="external"]') ||
                        target.matches('[target="_blank"]'),
                };

                var onClick: mmOptionsOnclick = {
                    close: null,
                    setSelected: null,
                    preventDefault:
                        target.getAttribute('href').slice(0, 1) == '#',
                };

                //	Find hooked behavior.
                for (let c = 0; c < this.clck.length; c++) {
                    let click = this.clck[c].call(this, target, args);

                    if (click) {
                        if (typeof click == 'boolean') {
                            evnt.preventDefault();
                            return;
                        }
                        if (type(click) == 'object') {
                            onClick = extend(click, onClick);
                        }
                    }
                }

                //	Default behavior for anchors in lists.
                if (args.inMenu && args.inListview && !args.toExternal) {
                    //	Set selected item, Default: true
                    if (
                        valueOrFn(
                            target,
                            this.opts.onClick.setSelected,
                            onClick.setSelected
                        )
                    ) {
                        this.setSelected(target.parentElement);
                    }

                    //	Prevent default / don't follow link. Default: false.
                    if (
                        valueOrFn(
                            target,
                            this.opts.onClick.preventDefault,
                            onClick.preventDefault
                        )
                    ) {
                        evnt.preventDefault();
                    }

                    //	Close menu. Default: false
                    if (
                        valueOrFn(
                            target,
                            this.opts.onClick.close,
                            onClick.close
                        )
                    ) {
                        if (
                            this.opts.offCanvas &&
                            typeof this.close == 'function'
                        ) {
                            this.close();
                        }
                    }
                }
            },
            true
        );

        //	Invoke "after" hook.
        this.trigger('initAnchors:after');
    }

    /**
     * Get the translation for a text.
     * @param  {string} text 	Text to translate.
     * @return {string}			The translated text.
     */
    i18n(text: string): string {
        return i18n.get(text, this.conf.language);
    }
}

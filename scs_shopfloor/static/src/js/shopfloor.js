/** @odoo-module **/

import publicWidget from "@web/legacy/js/public/public_widget";
import { jsonrpc } from "@web/core/network/rpc_service";
import { _t } from "@web/core/l10n/translation";

function formatMinutes(value) {
    if (value === false) {
        return "";
    }
    const isNegative = value < 0;
    if (isNegative) {
        value = Math.abs(value);
    }
    let min = Math.floor(value);
    let sec = Math.round((value % 1) * 60);
    sec = `${sec}`.padStart(2, "0");
    min = `${min}`.padStart(2, "0");
    return `${isNegative ? "-" : ""}${min}:${sec}`;
}

const ShopFloorTimer = publicWidget.Widget.extend({
    selector: '.portal_shopfloor',
    events: {
        'click a.startFloor': '_onstartFloor',
        'click a.pauseFloor': '_onpauseFloor',
        'click a.stopFloor': '_onstopFloor',
    },

    /**
     * @override
     */
    start: function () {
        this.$wrapper = this.$('.portal_my_home_shopfloor_ext');
        this.checkRunningTimers()
        return this._super(...arguments);
    },
    /**
     * calculates the whole timer, including one timer for each time unit.
     *
     * @private
     */
    _render: function (Order_Id) {        
        const timerElement = document.getElementById('timer' + Order_Id);
        if (timerElement){
            let initialMinutes = parseInt(timerElement.textContent.split(':')[0], 10);
            let initialSeconds = parseInt(timerElement.textContent.split(':')[1], 10);
            
            let initialElapsedTime = (initialMinutes * 60 * 1000) + (initialSeconds * 1000);
            const startTime = Date.now() - initialElapsedTime;
            
            function updateTimer() {
                const now = Date.now();
                const elapsedTime = now - startTime;
                const minutes = Math.floor(elapsedTime / (1000 * 60));
                const seconds = Math.floor((elapsedTime % (1000 * 60)) / 1000);
        
                const minutesFormatted = String(minutes).padStart(2, '0');
                const secondsFormatted = String(seconds).padStart(2, '0');
        
                timerElement.textContent = `${minutesFormatted}:${secondsFormatted}`;
            }
        
            setInterval(updateTimer, 1000);
            updateTimer();
        }
    },    

    _onstartFloor: function (ev) {
        const Order_Id = $(ev.currentTarget).data('order-id');        
        this.setInterval = setInterval(() => this._render(Order_Id), 1000);
    },

    _onpauseFloor: function () {
        clearInterval(this.setInterval);
    },

    _onstopFloor: function () {
        clearInterval(this.setInterval);
    },

    checkRunningTimers: function () {
        const allTimers = $('.timerEl');
        const self = this;
        allTimers.each(async function() {
            let isStillRunning = $(this).data('is_user_working');            
            let order_id = $(this).data('order_id');
            let lastDate = await jsonrpc(`/web/dataset/call_kw/mrp.workorder/get_duration_data`, {
                model: "mrp.workorder",
                method: "get_duration_data",
                args: [[order_id]],
                kwargs: {},
            });
            let valid_time = formatMinutes(lastDate)
            
            $(this).text(valid_time)  
            if (isStillRunning !== undefined) {
                self._render(order_id);
            }
        });
    },
    
})
publicWidget.registry.shopfloorTimer = ShopFloorTimer;
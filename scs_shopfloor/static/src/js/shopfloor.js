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
        'click div.tigger_WO_action' : '_trigger_workOrder_action',
        'click a.startFloor': '_onstartFloor',
        'click a.pauseFloor': '_onpauseFloor',
        'click button#cloWO': '_onstopFloor',
        'click li.registerProduction': 'onclickRegiserProduction',
        'click .close-register-dialog': '_closeModal',
        'click .close_scrap_dialog': '_closeScrapModal',
        'click .close-dropdown-dialog': '_closeDropdownModal',
        'click .save-register-changes': '_submitRegisterModal',
        'click .show-dropdown-options': '_openDropdownModal',
        'click .scrap-product': '_onshowScrapProductDialog',
        'click .close_scrap_warning_dialog': '_oncloseScrapDialog',
        'click .btn-scrap-products': '_onscrapProduct',

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

    _trigger_workOrder_action: function (ev) {
        const trigger_action = $(ev.currentTarget).data('trigger');  
        if (trigger_action == undefined){
            alert('You cannot start a work order that is already done or cancelled')
        }
        if (trigger_action == 'start'){
            this._onstartFloor(ev)
        }
        else if (trigger_action == 'pause'){
            this._onpauseFloor(ev)
        }
    },

    onclickRegiserProduction: function(ev) {
        var modal = $(ev.currentTarget).closest('ul').find('div.register_production_modal');
        modal.is(':visible') ? modal.modal('hide').removeClass('show').hide() : modal.addClass('show').show().modal({ backdrop: "static", show: true });
    },
    
    _openDropdownModal:function (ev) {
        var modal = $(ev.currentTarget).closest('div').find('div.dropdown_options_modal');
        modal.is(':visible') ? modal.modal('hide').removeClass('show').hide() : modal.addClass('show').show().modal({ backdrop: "static", show: true });
    },
    
    _onshowScrapProductDialog:function (ev) {
        var modal = $(ev.currentTarget).closest('div.card-footer').find('div.dropdown_options_modal');
        modal.modal('hide').hide().removeClass('show');        
        var scrapmodal = $(ev.currentTarget).closest('div.card-footer').find('div.scrap_product_modal');
        scrapmodal.is(':visible') ? scrapmodal.modal('hide').removeClass('show').hide() : scrapmodal.addClass('show').show().modal({ backdrop: "static", show: true });
    },

    _onscrapProduct: async function (ev) {
        let form = $(ev.currentTarget).closest('div.card-footer').find('form');
        let formData = form.serializeArray().reduce((obj, item) => {
            obj[item.name] = item.value;
            return obj;
        }, {});
    
        const Order_Id = form.data('order_id');        
        let productname = form.find('select option:selected').text();
        let result = await jsonrpc(`/product/scrap/${Order_Id}`, formData);
    
        $(ev.currentTarget).closest('div.card-footer').find('div.scrap_product_modal').modal('hide').removeClass('show');
    
        if (result === true) {
            location.reload();
            return true;
        }
    
        if (result.action && result.action.res_model === "stock.warn.insufficient.qty.scrap") {
            let uom_name = result.action.context.default_product_uom_name;
            let scrap_id = result.action.context.default_scrap_id;
            let insufficientModal = $(ev.currentTarget).closest('div.card-footer').find('div.insufficent_scrap_product_modal');
    
            insufficientModal.find('.insufficient-product-header').html(`${productname}: Insufficient Quantity To Scrap.`);
            insufficientModal.find('.insufficient-product-body').html(`The product is not available in sufficient quantity.<br/> Do you confirm you want to scrap ${formData['scrap_qty']} ${uom_name} from location? This may lead to inconsistencies in inventory.`);
            insufficientModal.is(':visible') ? insufficientModal.modal('hide').removeClass('show').hide() : insufficientModal.addClass('show').show().modal({ backdrop: "static", show: true });
    
            insufficientModal.find('.btn-confirm-scrap-products').off('click').on('click', async function() {
                await jsonrpc(`/product/scrap/done/${scrap_id}`, {});
                location.reload();
            });
        }
    },
    

    _onstartFloor:async function (ev) {        
        const Order_Id = $(ev.currentTarget).data('order-id');        
        location.href = `/work/order/${Order_Id}/start`
        this.setInterval = setInterval(() => this._render(Order_Id), 1000);
    },

    _onpauseFloor:async function (ev) {
        const Order_Id = $(ev.currentTarget).data('order-id');        
        location.href = `/work/order/${Order_Id}/pause`
        clearInterval(this.setInterval);
    },

    _onstopFloor:async function (ev) {
        const Order_Id = $(ev.currentTarget).data('order-id');        
        location.href = `/work/order/${Order_Id}/done`
        clearInterval(this.setInterval);
    },

    _closeModal:  function (ev) {
        var modal = $(ev.currentTarget).closest('ul').find('div.register_production_modal');
        modal.modal('hide').hide().removeClass('show');        
    },

    _closeDropdownModal:  function (ev) {
        var modal = $(ev.currentTarget).closest('div.card-footer').find('div.dropdown_options_modal');
        modal.modal('hide').hide().removeClass('show');        
    },

    _closeScrapModal:function (ev) {
        var modal = $(ev.currentTarget).closest('div.card-footer').find('div.scrap_product_modal');
        modal.modal('hide').hide().removeClass('show');    
    },

    _oncloseScrapDialog: function (ev) {
        var modal = $(ev.currentTarget).closest('div.card-footer').find('div.insufficent_scrap_product_modal');
        modal.modal('hide').hide().removeClass('show');  
    },

    _submitRegisterModal: async function (ev) {
        let order_id = $(ev.currentTarget).data('order_id');
        var modal = $(ev.currentTarget).closest('ul').find('div.register_production_modal');
        let selected_lot = modal.find('select#finished_lot_id').val();
        let registerQTY = modal.find("input[name='register_qty']").val();
        
        await jsonrpc(`/web/dataset/call_kw/mrp.workorder/set_qty_producing_portal`, {
            model: "mrp.workorder",
            method: "set_qty_producing_portal",
            args: [[order_id],selected_lot,registerQTY],
            kwargs: {},
        });
        modal.modal('hide').hide().removeClass('show');
        location.reload()
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
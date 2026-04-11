import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';


interface FAQ {
  q: string;
  a: string;
  isOpen: boolean;
}

@Component({
  selector: 'app-support',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  templateUrl: './support.component.html'
})
export class SupportComponent {
  
  public faqs: FAQ[] = [
    { 
      q: 'Как работает оплата через Kaspi?', 
      a: 'После оформления заказа нажмите кнопку "Оплатить в Kaspi". Система предложит вам перейти в приложение Kaspi или покажет номер для перевода. После оплаты заведение увидит ваш заказ и примет его в работу.',
      isOpen: false 
    },
    { 
      q: 'Что делать, если я указал неверный адрес?', 
      a: 'Если заказ еще не перешел в статус "В работе", вы можете отменить его и создать новый. Если заказ уже готовится, немедленно свяжитесь с поддержкой через WhatsApp, чтобы мы передали изменения курьеру.',
      isOpen: false 
    },
    { 
      q: 'Где найти код для получения заказа?', 
      a: 'Код чека (4 цифры) отображается в разделе "Мои заказы" на карточке вашего активного заказа. Покажите этот код сотруднику заведения для получения еды.',
      isOpen: false 
    },
    { 
      q: 'Могу ли я отменить заказ?', 
      a: 'Отмена возможна только до того момента, как заведение приняло заказ в работу (статус PENDING). После начала приготовления отмена через приложение невозможна.',
      isOpen: false 
    }
  ];

  public contacts = {
    whatsapp: 'https://wa.me/77028131494',
    telegram: 'https://t.me/mbtvds',
    email: 'umbetov.dias@mail.ru'
  };

  toggleFaq(index: number): void {
    this.faqs[index].isOpen = !this.faqs[index].isOpen;
  }

}
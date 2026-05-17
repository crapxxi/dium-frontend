import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

interface TractionItem {
  id: number;
  tagKey: string;
  titleKey: string;
  bodyKey: string;
  monthKey: string;
  showMonth: boolean;
  highlight: boolean;
}

@Component({
  selector: 'app-traction',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  templateUrl: './traction.component.html'
})
export class TractionComponent {
  news: TractionItem[] = [
    {
      id: 1,
      tagKey: 'TRACTION.N1_TAG',
      titleKey: 'TRACTION.N1_TITLE',
      bodyKey: 'TRACTION.N1_BODY',
      monthKey: 'TRACTION.MONTH_JAN',
      showMonth: true,
      highlight: false
    },
    {
      id: 2,
      tagKey: 'TRACTION.N2_TAG',
      titleKey: 'TRACTION.N2_TITLE',
      bodyKey: 'TRACTION.N2_BODY',
      monthKey: 'TRACTION.MONTH_FEB',
      showMonth: true,
      highlight: false
    },
    {
      id: 3,
      tagKey: 'TRACTION.N3_TAG',
      titleKey: 'TRACTION.N3_TITLE',
      bodyKey: 'TRACTION.N3_BODY',
      monthKey: 'TRACTION.MONTH_FEB',
      showMonth: false,
      highlight: false
    },
    {
      id: 4,
      tagKey: 'TRACTION.N4_TAG',
      titleKey: 'TRACTION.N4_TITLE',
      bodyKey: 'TRACTION.N4_BODY',
      monthKey: 'TRACTION.MONTH_MAR',
      showMonth: true,
      highlight: true
    },
    {
      id: 5,
      tagKey: 'TRACTION.N5_TAG',
      titleKey: 'TRACTION.N5_TITLE',
      bodyKey: 'TRACTION.N5_BODY',
      monthKey: 'TRACTION.MONTH_APR',
      showMonth: true,
      highlight: false
    },
    {
      id: 6,
      tagKey: 'TRACTION.N6_TAG',
      titleKey: 'TRACTION.N6_TITLE',
      bodyKey: 'TRACTION.N6_BODY',
      monthKey: 'TRACTION.MONTH_APR',
      showMonth: false,
      highlight: false
    },
    {
      id: 7,
      tagKey: 'TRACTION.N7_TAG',
      titleKey: 'TRACTION.N7_TITLE',
      bodyKey: 'TRACTION.N7_BODY',
      monthKey: 'TRACTION.MONTH_MAY',
      showMonth: true,
      highlight: false
    }
  ];
}

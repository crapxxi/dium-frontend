import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Venue, Product } from '../../models/api.models';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { TranslateModule } from '@ngx-translate/core';


interface VenueWithProducts extends Venue {
  hasItemsInStock?: boolean;
}

@Component({
  selector: 'app-venue-list',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  templateUrl: './venue-list.component.html'
})
export class VenueListComponent implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  
  venues: VenueWithProducts[] = [];
  isLoading = true;

  ngOnInit() {
    this.loadVenuesAndStatus();
  }

  loadVenuesAndStatus() {
    this.isLoading = true;

    this.http.get<Venue[]>(`${environment.apiUrl}/venues`).pipe(
      switchMap(venues => {
        if (venues.length === 0) return of([]);

        const requests = venues.map(venue => 
          this.http.get<Product[]>(`${environment.apiUrl}/products/venue/${venue.id}`).pipe(
            catchError(() => of([])),
            switchMap(products => {
              const hasItems = products.some(p => p.inStock);
              return of({ ...venue, hasItemsInStock: hasItems });
            })
          )
        );
        return forkJoin(requests);
      }),
      finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (data) => {
        const ranked = (v: VenueWithProducts): number => {
          if (v.isWorking && v.hasItemsInStock) return 0;
          if (!v.isWorking) return 1;
          return 2; // sold out
        };
        this.venues = (data as VenueWithProducts[]).sort((a, b) => {
          const diff = ranked(a) - ranked(b);
          if (diff !== 0) return diff;
          return a.name.localeCompare(b.name);
        });
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Ошибка загрузки:', err)
    });
  }
}
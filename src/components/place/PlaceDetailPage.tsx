'use client'

import { useRouter } from 'next/navigation'
import { EventIcon } from '@/components/event/EventIcon'
import EventMiniMap from '@/components/event/EventMiniMap'
import { ROUTES } from '@/lib/constants/routes'
import { PlaceDetail, PLACE_TYPE_LABEL } from '@/services/placeService'
import styles from './PlaceDetailPage.module.css'

export default function PlaceDetailPage({ place }: { place: PlaceDetail }) {
  const router = useRouter()
  const typeLabel = PLACE_TYPE_LABEL[place.placeType] ?? '장소'

  return (
    <div className={styles.page}>
      {/* 히어로 */}
      <div className={styles.hero}>
        {place.coverUrl && <img className={styles.heroImg} src={place.coverUrl} alt="" />}
        <div className={styles.heroBody}>
          <span className={styles.typeBadge}>{typeLabel}</span>
          <h1 className={styles.name}>{place.name}</h1>
          {place.addr && <p className={styles.addr}><EventIcon name="pin" size={15} color="var(--muted)" />{place.addr}</p>}
        </div>
      </div>

      <div className={styles.layout}>
        <main className={styles.main}>
          {/* 지도 */}
          {place.lat && place.lng && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}><EventIcon name="pin" size={17} color="var(--accent)" />위치</h2>
              <EventMiniMap lat={place.lat} lng={place.lng} name={place.name} height={240} />
              <div className={styles.mapActions}>
                <button onClick={() => window.open(`https://map.kakao.com/link/to/${encodeURIComponent(place.name)},${place.lat},${place.lng}`, '_blank')}>
                  길찾기
                </button>
              </div>
            </section>
          )}

          {/* 입점 샵 */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>
              <EventIcon name="bag" size={17} color="var(--accent)" />
              입점 샵 <span className={styles.count}>{place.shops.length}</span>
            </h2>
            {place.shops.length === 0 ? (
              <p className={styles.empty}>아직 등록된 입점 샵이 없어요.</p>
            ) : (
              <ul className={styles.shopList}>
                {place.shops.map(s => (
                  <li key={s.id} className={styles.shopRow} onClick={() => router.push(ROUTES.shop(s.slug))}>
                    <div className={styles.shopThumb}>
                      {s.images[0] ? <img src={s.images[0]} alt="" /> : <span className={styles.noImg} />}
                    </div>
                    <div className={styles.shopInfo}>
                      <div className={styles.shopName}>
                        {s.name}
                        {s.floor && <span className={styles.floor}>{s.floor}{s.unit ? ` ${s.unit}` : ''}</span>}
                      </div>
                      <div className={styles.shopMeta}>
                        {s.cat && <span>{s.cat}</span>}
                        {s.rating_count > 0 && <span>★ {s.rating_avg.toFixed(1)}</span>}
                      </div>
                    </div>
                    <span className={styles.chev}>›</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 진행 중 이벤트 */}
          {place.events.length > 0 && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>
                <EventIcon name="party" size={17} color="var(--accent)" />
                진행 중 이벤트 <span className={styles.count}>{place.events.length}</span>
              </h2>
              <div className={styles.eventGrid}>
                {place.events.map(e => (
                  <article key={e.id} className={styles.eventCard} onClick={() => router.push(`/event/${e.id}`)}>
                    <div className={styles.eventThumb}>
                      {e.cover ? <img src={e.cover} alt="" /> : <span className={styles.noImg} />}
                    </div>
                    <div className={styles.eventBody}>
                      <div className={styles.eventTitle} title={e.title}>{e.title}</div>
                      {e.shopName && <div className={styles.eventShop}>{e.shopName}</div>}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </main>

        {/* 우측 레일: 시설 정보 */}
        <aside className={styles.rail}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>시설 안내</h2>
            <dl className={styles.facility}>
              <div>
                <dt>주차</dt>
                <dd>{place.parking === true ? '가능' : place.parking === false ? '불가' : '정보 없음'}
                  {place.parkingNote && <span className={styles.note}> · {place.parkingNote}</span>}
                </dd>
              </div>
              {place.district && (
                <div><dt>지역</dt><dd>{place.region} {place.district}</dd></div>
              )}
            </dl>
            {place.description && <p className={styles.desc}>{place.description}</p>}
          </section>
        </aside>
      </div>
    </div>
  )
}

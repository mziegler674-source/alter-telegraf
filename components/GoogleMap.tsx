export default function GoogleMap() {
    return (
      <div className="h-[450px] w-full">
        <iframe
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2716.967292200588!2d15.436336976710377!3d47.080105024185706!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x476e35853eede0f9%3A0x3c43408b39d9d434!2sHotel%20Alter%20Telegraf!5e0!3m2!1sde!2sat!4v1789086326463!5m2!1sde!2sat"
          width="100%"
          height="450"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          title="Hotel Alter Telegraf auf Google Maps"
        />
      </div>
    );
  }
module video::waltube {

    use sui::object::{Self, UID};
    use sui::tx_context::TxContext;
    use std::string::String;


    public struct Video has store, drop {
        title: String,
        description: String,
        vault_id: String,
        owner_name: String
    }

    public struct User has store, drop {
        name: String,
        surname: String,
        email: String,
        phone_num: String,
        country: String,
        video_count: u64,
        vids: vector<Video>
    }

    public fun add_to_list(
        title: String,
        description: String,
        vault_id: String,
        user: &mut User,
    ) {
        let video = Video {
            title,
            description,
            vault_id,
            owner_name: user.name
        };
        vector::push_back(&mut user.vids, video);
        user.video_count = user.video_count + 1;
    }


    public fun edit_video_by_id(
        user: &mut User,
        new_title: String,
        new_description: String,
        vault_id: String,
    ) {

        let len = vector::length(&user.vids);
        let mut i = 0;
        let mut found = false;
        while (i < len) {
            let video_ref = vector::borrow_mut(&mut user.vids, i);
            if (video_ref.vault_id == vault_id) {
                video_ref.title = new_title;
                video_ref.description = new_description;
                found = true;
                break;
            };
            i = i + 1;
        };

        assert!(found, 1); // Fail if no matching title was found
    }

    public fun delete_video_by_id(
        user: &mut User,
        vault_id: String,
    ) {

        let len = vector::length(&user.vids);
        let mut i = 0;
        let mut found = false;
        while (i < len) {
            let video_ref = vector::borrow_mut(&mut user.vids, i);
            if (video_ref.vault_id == vault_id) {
                vector::remove(&mut user.vids, i);
                user.video_count = user.video_count - 1;
                found = true;
                break;
            };
            i = i + 1;
        };

        assert!(found, 1); // Fail if no matching title was found
    }

    public fun replace_video_list(
        user: &mut User,
        new_videos: vector<Video>,
    ) {
        user.vids = new_videos;
        user.video_count = vector::length(&user.vids);
    }

    public fun create_user(
    name: String,
    surname: String,
    email: String,
    phone_num: String,
    country: String,
): User {
    User {
        name,
        surname,
        email,
        phone_num,
        country,
        video_count: 0,
        vids: vector::empty<Video>()
    }
}

public fun edit_user_info(
    user: &mut User,
    new_name: String,
    new_surname: String,
    new_email: String,
    new_phone_num: String,
    new_country: String,
) {

    user.name = new_name;
    user.surname = new_surname;
    user.email = new_email;
    user.phone_num = new_phone_num;
    user.country = new_country;
}


}


